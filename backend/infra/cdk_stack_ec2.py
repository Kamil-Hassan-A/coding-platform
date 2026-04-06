from aws_cdk import (
    Stack,
    aws_ec2 as ec2,
    CfnOutput,
    CfnParameter
)
from constructs import Construct

class Ec2SingleInstanceStack(Stack):

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ----------------------------------------------------------------------
        # Parameters
        # ----------------------------------------------------------------------
        instance_type_param = CfnParameter(
            self, "InstanceType",
            type="String",
          default="t3.micro",
          description="EC2 Instance Type (free-tier friendly default: t3.micro)"
        )

        key_name_param = CfnParameter(
            self, "KeyName",
            type="AWS::EC2::KeyPair::KeyName",
            description="Name of an existing EC2 KeyPair to enable SSH access"
        )
        
        admin_ip_param = CfnParameter(
            self, "AdminIpCidr",
            type="String",
            default="0.0.0.0/0",
            description="CIDR block to allow SSH access from (default is anywhere, recommended to restrict)"
        )

        # ----------------------------------------------------------------------
        # VPC Setup
        # ----------------------------------------------------------------------
        # Create a simple VPC with a single public subnet. No NAT gateways to save costs.
        vpc = ec2.Vpc(
            self, "CodingPlatformVpc",
            max_azs=1,
            nat_gateways=0,
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="PublicSubnet",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24
                )
            ]
        )

        # ----------------------------------------------------------------------
        # Security Group
        # ----------------------------------------------------------------------
        sg = ec2.SecurityGroup(
            self, "InstanceSg",
            vpc=vpc,
            description="Allow SSH, HTTP, HTTPS, Judge0 and FastAPI ports",
            allow_all_outbound=True
        )

        # Add inbound rules
        sg.add_ingress_rule(ec2.Peer.ipv4(admin_ip_param.value_as_string), ec2.Port.tcp(22), "Allow SSH")
        sg.add_ingress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(80), "Allow HTTP")
        sg.add_ingress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(443), "Allow HTTPS")
        sg.add_ingress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(2358), "Allow Judge0 API")
        sg.add_ingress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(8000), "Allow FastAPI App")

        # ----------------------------------------------------------------------
        # EC2 Instance
        # ----------------------------------------------------------------------
        # Resolve Ubuntu AMI from SSM to stay compatible with this CDK version.
        ubuntu_ami_ssm_parameter = "/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id"
        machine_image = ec2.MachineImage.from_ssm_parameter(
            parameter_name=ubuntu_ami_ssm_parameter
        )

        # Create the EC2 instance
        instance = ec2.Instance(
            self, "CodingPlatformInstance",
            instance_type=ec2.InstanceType(instance_type_param.value_as_string),
            machine_image=machine_image,
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PUBLIC),
            security_group=sg,
            key_name=key_name_param.value_as_string,
            user_data_causes_replacement=True,
            block_devices=[
                ec2.BlockDevice(
                    device_name="/dev/sda1",
                    volume=ec2.BlockDeviceVolume.ebs(
                        volume_size=50,
                        volume_type=ec2.EbsDeviceVolumeType.GP3
                    )
                )
            ]
        )

        # ----------------------------------------------------------------------
        # User Data (Bootstrap Script)
        # ----------------------------------------------------------------------
        # This bash script will automatically execute on the first boot.
        user_data_script = """#!/bin/bash
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y docker.io docker-compose git nginx jq pwgen

systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu || true

# Add swap so t3.micro can handle Docker image builds more reliably.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
fi
swapon /swapfile || true
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

WORKDIR=/home/ubuntu/coding-platform
REPO_URL=https://github.com/Kamil-Hassan-A/coding-platform.git
REPO_DIR=$WORKDIR/repo

mkdir -p $WORKDIR
cd $WORKDIR

# Clone full repository so all backend modules are available in the image build context.
if [ ! -d "$REPO_DIR/.git" ]; then
  git clone $REPO_URL "$REPO_DIR"
else
  cd "$REPO_DIR"
  git fetch --all --prune
  git reset --hard origin/main
  cd "$WORKDIR"
fi

POSTGRES_PASSWORD=$(pwgen -s 32 1)
REDIS_PASSWORD=$(pwgen -s 32 1)
SECRET_KEY_BASE=$(pwgen -s 64 1)
JWT_SECRET_KEY=$(pwgen -s 64 1)
JUDGE0_PROXY_TOKEN=$(pwgen -s 64 1)
ADMIN_SEED_KEY=$(pwgen -s 64 1)

cat <<EOF > .env
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=judge0
CODINGPLATFORM_DB=codingplatform

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD

SECRET_KEY_BASE=$SECRET_KEY_BASE
JWT_SECRET_KEY=$JWT_SECRET_KEY
JUDGE0_PROXY_TOKEN=$JUDGE0_PROXY_TOKEN
ADMIN_SEED_KEY=$ADMIN_SEED_KEY

# Judge0 explicit variables
JUDGE0_DB_ADAPTER=postgresql
JUDGE0_DB_HOST=postgres
JUDGE0_DB_PORT=5432
JUDGE0_DB_NAME=judge0
JUDGE0_DB_USERNAME=postgres
JUDGE0_DB_PASSWORD=$POSTGRES_PASSWORD
JUDGE0_REDIS_HOST=redis
JUDGE0_REDIS_PORT=6379
JUDGE0_REDIS_PASSWORD=$REDIS_PASSWORD
EOF

cat <<'EOF' > init-db.sql
CREATE DATABASE codingplatform;
EOF

cat <<'EOF' > repo/backend/wait-for-postgres.sh
#!/bin/sh
set -eu

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

until PGPASSWORD="$POSTGRES_PASSWORD" pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" >/dev/null 2>&1; do
  echo "Waiting for Postgres at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
  sleep 2
done

exec uvicorn main:app --host 0.0.0.0 --port 8000
EOF

cat <<'EOF' > backend.Dockerfile
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*

# Copy full backend source tree (routes, models, schemas, scripts, etc.)
COPY repo/backend /app

RUN pip install --no-cache-dir -r requirements.txt
RUN chmod +x /app/wait-for-postgres.sh

CMD ["/app/wait-for-postgres.sh"]
EOF

cat <<'EOF' > docker-compose.yml
version: '3.8'

x-logging:
  &default-logging
  logging:
    driver: json-file
    options:
      max-size: 100m

services:
  postgres:
    image: postgres:13
    env_file: .env
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    restart: always
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 12
    <<: *default-logging

  redis:
    image: redis:6.0
    env_file: .env
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD}"]
    restart: always
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a ${REDIS_PASSWORD} ping | grep PONG"]
      interval: 10s
      timeout: 5s
      retries: 12
    <<: *default-logging

  judge0-server:
    image: judge0/judge0:1.13.1
    env_file: .env
    ports:
      - "2358:2358"
    restart: always
    privileged: true
    depends_on:
      - postgres
      - redis
    <<: *default-logging

  judge0-worker:
    image: judge0/judge0:1.13.1
    command: ["./scripts/workers"]
    env_file: .env
    restart: always
    privileged: true
    depends_on:
      - postgres
      - redis
    <<: *default-logging

  backend:
    build:
      context: .
      dockerfile: backend.Dockerfile
    env_file: .env
    environment:
      DATABASE_URL: postgresql+psycopg2://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${CODINGPLATFORM_DB}
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: ${CODINGPLATFORM_DB}
      DB_USER: ${POSTGRES_USER}
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      JUDGE0_BASE_URL: http://judge0-server:2358
      JUDGE0_PROXY_TOKEN: ${JUDGE0_PROXY_TOKEN}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      ADMIN_SEED_KEY: ${ADMIN_SEED_KEY}
    ports:
      - "8000:8000"
    restart: always
    depends_on:
      - postgres
      - judge0-server
    <<: *default-logging

volumes:
  postgres-data:
  redis-data:
EOF

# Nginx reverse proxy: public :80 -> backend :8000
cat <<'EOF' > /etc/nginx/sites-available/default
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

systemctl enable nginx
systemctl restart nginx

chown -R ubuntu:ubuntu $WORKDIR

cd $WORKDIR

# Bring infra up first.
docker-compose up -d postgres redis

for i in $(seq 1 60); do
  if docker-compose exec -T postgres pg_isready -U postgres -d judge0 >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# Ensure codingplatform DB exists even when postgres volume already exists.
docker-compose exec -T postgres psql -U postgres -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='codingplatform'" | grep -q 1 || \
  docker-compose exec -T postgres psql -U postgres -d postgres -c "CREATE DATABASE codingplatform;"

docker-compose up -d judge0-server judge0-worker
docker-compose up -d --build backend

# One-time schema bootstrap for platform tables.
docker-compose exec -T backend python -c "from sqlalchemy import create_engine; from models import Base; from database import build_database_url; engine = create_engine(build_database_url(), pool_pre_ping=True); Base.metadata.create_all(bind=engine)"
"""
        # Attach the User Data script to the EC2 instance
        instance.add_user_data(user_data_script)

        # ----------------------------------------------------------------------
        # Outputs
        # ----------------------------------------------------------------------
        CfnOutput(
            self, "InstancePublicIp",
            value=instance.instance_public_ip,
            description="Public IP of the EC2 instance"
        )
        
        CfnOutput(
            self, "InstanceId",
            value=instance.instance_id,
            description="Instance ID"
        )
        
        CfnOutput(
            self, "InstancePublicDnsName",
            value=instance.instance_public_dns_name,
            description="Public DNS name of the EC2 instance"
        )
