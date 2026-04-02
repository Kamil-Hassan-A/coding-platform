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

# Pull the actual project backend code.
if [ ! -d "$REPO_DIR/.git" ]; then
  git clone --depth 1 $REPO_URL "$REPO_DIR"
else
  cd "$REPO_DIR"
  git fetch --all --prune
  git reset --hard origin/main
  cd "$WORKDIR"
fi

POSTGRES_PASSWORD=$(pwgen -s 32 1)
REDIS_PASSWORD=$(pwgen -s 32 1)
SECRET_KEY_BASE=$(pwgen -s 32 1)
JWT_SECRET_KEY=$(pwgen -s 40 1)
JUDGE0_PROXY_TOKEN=$(pwgen -s 40 1)
ADMIN_SEED_KEY=$(pwgen -s 40 1)

cat <<EOF > .env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=judge0
REDIS_PASSWORD=$REDIS_PASSWORD
SECRET_KEY_BASE=$SECRET_KEY_BASE
JWT_SECRET_KEY=$JWT_SECRET_KEY
JUDGE0_PROXY_TOKEN=$JUDGE0_PROXY_TOKEN
ADMIN_SEED_KEY=$ADMIN_SEED_KEY
EOF

cat <<'EOF' > init-db.sql
CREATE DATABASE codingplatform;
EOF

cat <<EOF > judge0.conf
REDIS_PASSWORD=$REDIS_PASSWORD
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
EOF

# Build backend from the cloned repository source code.
cat <<'EOF' > backend.Dockerfile
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY repo/backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY repo/backend/*.py /app/
COPY repo/backend/routes /app/routes
COPY repo/backend/scripts /app/scripts

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
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
    restart: always
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql:ro
    <<: *default-logging

  redis:
    image: redis:6.0
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD}"]
    env_file: .env
    restart: always
    volumes:
      - redis-data:/data
    <<: *default-logging

  judge0-server:
    image: judge0/judge0:1.13.1
    volumes:
      - ./judge0.conf:/judge0.conf:ro
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
    volumes:
      - ./judge0.conf:/judge0.conf:ro
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
    ports:
      - "8000:8000"
    restart: always
    depends_on:
      - postgres
      - judge0-server
    environment:
      DATABASE_URL: postgresql+psycopg2://postgres:${POSTGRES_PASSWORD}@postgres:5432/codingplatform
      JUDGE0_BASE_URL: http://judge0-server:2358
      JUDGE0_PROXY_TOKEN: ${JUDGE0_PROXY_TOKEN}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      ADMIN_SEED_KEY: ${ADMIN_SEED_KEY}
    <<: *default-logging

volumes:
  postgres-data:
  redis-data:
EOF

# Proxy port 80 to backend:8000 so opening public IP works directly.
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

# Start core infra first, then ensure the backend database exists.
docker-compose up -d postgres redis judge0-server judge0-worker

for i in $(seq 1 40); do
  if docker-compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker-compose exec -T postgres psql -U postgres -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='codingplatform'" | grep -q 1 || \
  docker-compose exec -T postgres psql -U postgres -d postgres -c "CREATE DATABASE codingplatform;"

docker-compose up -d --build backend
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
