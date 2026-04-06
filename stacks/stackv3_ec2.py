{
  "Parameters": {
    "InstanceType": {
      "Type": "String",
      "Default": "t3.micro",
      "Description": "EC2 Instance Type (free-tier friendly default: t3.micro)"
    },
    "KeyName": {
      "Type": "AWS::EC2::KeyPair::KeyName",
      "Description": "Name of an existing EC2 KeyPair to enable SSH access"
    },
    "AdminIpCidr": {
      "Type": "String",
      "Default": "0.0.0.0/0",
      "Description": "CIDR block to allow SSH access from (default is anywhere, recommended to restrict)"
    },
    "SsmParameterValueawsservicecanonicalubuntuserver2204stablecurrentamd64hvmebsgp2amiidC96584B6F00A464EAD1953AFF4B05118Parameter": {
      "Type": "AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>",
      "Default": "/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id"
    },
    "BootstrapVersion": {
      "Type": "AWS::SSM::Parameter::Value<String>",
      "Default": "/cdk-bootstrap/hnb659fds/version",
      "Description": "Version of the CDK Bootstrap resources in this environment, automatically retrieved from SSM Parameter Store. [cdk:skip]"
    }
  },
  "Resources": {
    "CodingPlatformVpc3E4816F7": {
      "Type": "AWS::EC2::VPC",
      "Properties": {
        "CidrBlock": "10.0.0.0/16",
        "EnableDnsHostnames": true,
        "EnableDnsSupport": true,
        "InstanceTenancy": "default",
        "Tags": [
          {
            "Key": "Name",
            "Value": "CodingPlatformEc2Stack/CodingPlatformVpc"
          }
        ]
      },
      "Metadata": {
        "aws:cdk:path": "CodingPlatformEc2Stack/CodingPlatformVpc/Resource"
      }
    },
    "CodingPlatformVpcPublicSubnetSubnet1Subnet939089F7": {
      "Type": "AWS::EC2::Subnet",
      "Properties": {
        "AvailabilityZone": {
          "Fn::Select": [
            0,
            {
              "Fn::GetAZs": ""
            }
          ]
        },
        "CidrBlock": "10.0.0.0/24",
        "MapPublicIpOnLaunch": true,
        "Tags": [
          {
            "Key": "aws-cdk:subnet-name",
            "Value": "PublicSubnet"
          },
          {
            "Key": "aws-cdk:subnet-type",
            "Value": "Public"
          },
          {
            "Key": "Name",
            "Value": "CodingPlatformEc2Stack/CodingPlatformVpc/PublicSubnetSubnet1"
          }
        ],
        "VpcId": {
          "Ref": "CodingPlatformVpc3E4816F7"
        }
      },
      "Metadata": {
        "aws:cdk:path": "CodingPlatformEc2Stack/CodingPlatformVpc/PublicSubnetSubnet1/Subnet"
      }
    },
    "CodingPlatformVpcPublicSubnetSubnet1RouteTable58A6548F": {
      "Type": "AWS::EC2::RouteTable",
      "Properties": {
        "Tags": [
          {
            "Key": "Name",
            "Value": "CodingPlatformEc2Stack/CodingPlatformVpc/PublicSubnetSubnet1"
          }
        ],
        "VpcId": {
          "Ref": "CodingPlatformVpc3E4816F7"
        }
      },
      "Metadata": {
        "aws:cdk:path": "CodingPlatformEc2Stack/CodingPlatformVpc/PublicSubnetSubnet1/RouteTable"
      }
    },
    "CodingPlatformVpcPublicSubnetSubnet1RouteTableAssociationCEC9D8EC": {
      "Type": "AWS::EC2::SubnetRouteTableAssociation",
      "Properties": {
        "RouteTableId": {
          "Ref": "CodingPlatformVpcPublicSubnetSubnet1RouteTable58A6548F"
        },
        "SubnetId": {
          "Ref": "CodingPlatformVpcPublicSubnetSubnet1Subnet939089F7"
        }
      },
      "Metadata": {
        "aws:cdk:path": "CodingPlatformEc2Stack/CodingPlatformVpc/PublicSubnetSubnet1/RouteTableAssociation"
      }
    },
    "CodingPlatformVpcPublicSubnetSubnet1DefaultRouteF7E9E7A4": {
      "Type": "AWS::EC2::Route",
      "Properties": {
        "DestinationCidrBlock": "0.0.0.0/0",
        "GatewayId": {
          "Ref": "CodingPlatformVpcIGW5F820137"
        },
        "RouteTableId": {
          "Ref": "CodingPlatformVpcPublicSubnetSubnet1RouteTable58A6548F"
        }
      },
      "DependsOn": [
        "CodingPlatformVpcVPCGW7D0DA495"
      ],
      "Metadata": {
        "aws:cdk:path": "CodingPlatformEc2Stack/CodingPlatformVpc/PublicSubnetSubnet1/DefaultRoute"
      }
    },
    "CodingPlatformVpcIGW5F820137": {
      "Type": "AWS::EC2::InternetGateway",
      "Properties": {
        "Tags": [
          {
            "Key": "Name",
            "Value": "CodingPlatformEc2Stack/CodingPlatformVpc"
          }
        ]
      },
      "Metadata": {
        "aws:cdk:path": "CodingPlatformEc2Stack/CodingPlatformVpc/IGW"
      }
    },
    "CodingPlatformVpcVPCGW7D0DA495": {
      "Type": "AWS::EC2::VPCGatewayAttachment",
      "Properties": {
        "InternetGatewayId": {
          "Ref": "CodingPlatformVpcIGW5F820137"
        },
        "VpcId": {
          "Ref": "CodingPlatformVpc3E4816F7"
        }
      },
      "Metadata": {
        "aws:cdk:path": "CodingPlatformEc2Stack/CodingPlatformVpc/VPCGW"
      }
    },
    "InstanceSg4966687D": {
      "Type": "AWS::EC2::SecurityGroup",
      "Properties": {
        "GroupDescription": "Allow SSH, HTTP, HTTPS, Judge0 and FastAPI ports",
        "SecurityGroupEgress": [
          {
            "CidrIp": "0.0.0.0/0",
            "Description": "Allow all outbound traffic by default",
            "IpProtocol": "-1"
          }
        ],
        "SecurityGroupIngress": [
          {
            "CidrIp": {
              "Ref": "AdminIpCidr"
            },
            "Description": "Allow SSH",
            "FromPort": 22,
            "IpProtocol": "tcp",
            "ToPort": 22
          },
          {
            "CidrIp": "0.0.0.0/0",
            "Description": "Allow HTTP",
            "FromPort": 80,
            "IpProtocol": "tcp",
            "ToPort": 80
          },
          {
            "CidrIp": "0.0.0.0/0",
            "Description": "Allow HTTPS",
            "FromPort": 443,
            "IpProtocol": "tcp",
            "ToPort": 443
          },
          {
            "CidrIp": "0.0.0.0/0",
            "Description": "Allow Judge0 API",
            "FromPort": 2358,
            "IpProtocol": "tcp",
            "ToPort": 2358
          },
          {
            "CidrIp": "0.0.0.0/0",
            "Description": "Allow FastAPI App",
            "FromPort": 8000,
            "IpProtocol": "tcp",
            "ToPort": 8000
          }
        ],
        "VpcId": {
          "Ref": "CodingPlatformVpc3E4816F7"
        }
      },
      "Metadata": {
        "aws:cdk:path": "CodingPlatformEc2Stack/InstanceSg/Resource"
      }
    },
    "CodingPlatformInstanceInstanceRoleEA041D20": {
      "Type": "AWS::IAM::Role",
      "Properties": {
        "AssumeRolePolicyDocument": {
          "Statement": [
            {
              "Action": "sts:AssumeRole",
              "Effect": "Allow",
              "Principal": {
                "Service": "ec2.amazonaws.com"
              }
            }
          ],
          "Version": "2012-10-17"
        },
        "Tags": [
          {
            "Key": "Name",
            "Value": "CodingPlatformEc2Stack/CodingPlatformInstance"
          }
        ]
      },
      "Metadata": {
        "aws:cdk:path": "CodingPlatformEc2Stack/CodingPlatformInstance/InstanceRole/Resource"
      }
    },
    "CodingPlatformInstanceInstanceProfileFCC69D46": {
      "Type": "AWS::IAM::InstanceProfile",
      "Properties": {
        "Roles": [
          {
            "Ref": "CodingPlatformInstanceInstanceRoleEA041D20"
          }
        ]
      },
      "Metadata": {
        "aws:cdk:path": "CodingPlatformEc2Stack/CodingPlatformInstance/InstanceProfile"
      }
    },
    "CodingPlatformInstanceD142B75D9a342d9b9fbff256": {
      "Type": "AWS::EC2::Instance",
      "Properties": {
        "AvailabilityZone": {
          "Fn::Select": [
            0,
            {
              "Fn::GetAZs": ""
            }
          ]
        },
        "BlockDeviceMappings": [
          {
            "DeviceName": "/dev/sda1",
            "Ebs": {
              "VolumeSize": 50,
              "VolumeType": "gp3"
            }
          }
        ],
        "IamInstanceProfile": {
          "Ref": "CodingPlatformInstanceInstanceProfileFCC69D46"
        },
        "ImageId": {
          "Ref": "SsmParameterValueawsservicecanonicalubuntuserver2204stablecurrentamd64hvmebsgp2amiidC96584B6F00A464EAD1953AFF4B05118Parameter"
        },
        "InstanceType": {
          "Ref": "InstanceType"
        },
        "KeyName": {
          "Ref": "KeyName"
        },
        "SecurityGroupIds": [
          {
            "Fn::GetAtt": [
              "InstanceSg4966687D",
              "GroupId"
            ]
          }
        ],
        "SubnetId": {
          "Ref": "CodingPlatformVpcPublicSubnetSubnet1Subnet939089F7"
        },
        "Tags": [
          {
            "Key": "Name",
            "Value": "CodingPlatformEc2Stack/CodingPlatformInstance"
          }
        ],
        "UserData": {
          "Fn::Base64": "#!/bin/bash\nset -euxo pipefail\n\nexport DEBIAN_FRONTEND=noninteractive\napt-get update -y\napt-get upgrade -y\napt-get install -y docker.io docker-compose git nginx jq pwgen\n\nsystemctl enable docker\nsystemctl start docker\nusermod -aG docker ubuntu || true\n\n# Add swap so t3.micro can handle Docker image builds more reliably.\nif [ ! -f /swapfile ]; then\n  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048\n  chmod 600 /swapfile\n  mkswap /swapfile\nfi\nswapon /swapfile || true\ngrep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab\n\nWORKDIR=/home/ubuntu/coding-platform\nREPO_URL=https://github.com/Kamil-Hassan-A/coding-platform.git\nREPO_DIR=$WORKDIR/repo\n\nmkdir -p $WORKDIR\ncd $WORKDIR\n\n# Clone full repository so all backend modules are available in the image build context.\nif [ ! -d \"$REPO_DIR/.git\" ]; then\n  git clone $REPO_URL \"$REPO_DIR\"\nelse\n  cd \"$REPO_DIR\"\n  git fetch --all --prune\n  git reset --hard origin/main\n  cd \"$WORKDIR\"\nfi\n\nPOSTGRES_PASSWORD=$(pwgen -s 32 1)\nREDIS_PASSWORD=$(pwgen -s 32 1)\nSECRET_KEY_BASE=$(pwgen -s 64 1)\nJWT_SECRET_KEY=$(pwgen -s 64 1)\nJUDGE0_PROXY_TOKEN=$(pwgen -s 64 1)\nADMIN_SEED_KEY=$(pwgen -s 64 1)\n\ncat <<EOF > .env\nPOSTGRES_HOST=postgres\nPOSTGRES_PORT=5432\nPOSTGRES_USER=postgres\nPOSTGRES_PASSWORD=$POSTGRES_PASSWORD\nPOSTGRES_DB=judge0\nCODINGPLATFORM_DB=codingplatform\n\nREDIS_HOST=redis\nREDIS_PORT=6379\nREDIS_PASSWORD=$REDIS_PASSWORD\n\nSECRET_KEY_BASE=$SECRET_KEY_BASE\nJWT_SECRET_KEY=$JWT_SECRET_KEY\nJUDGE0_PROXY_TOKEN=$JUDGE0_PROXY_TOKEN\nADMIN_SEED_KEY=$ADMIN_SEED_KEY\n\n# Judge0 explicit variables\nJUDGE0_DB_ADAPTER=postgresql\nJUDGE0_DB_HOST=postgres\nJUDGE0_DB_PORT=5432\nJUDGE0_DB_NAME=judge0\nJUDGE0_DB_USERNAME=postgres\nJUDGE0_DB_PASSWORD=$POSTGRES_PASSWORD\nJUDGE0_REDIS_HOST=redis\nJUDGE0_REDIS_PORT=6379\nJUDGE0_REDIS_PASSWORD=$REDIS_PASSWORD\nEOF\n\ncat <<'EOF' > init-db.sql\nCREATE DATABASE codingplatform;\nEOF\n\ncat <<'EOF' > repo/backend/wait-for-postgres.sh\n#!/bin/sh\nset -eu\n\n: \"${POSTGRES_HOST:=postgres}\"\n: \"${POSTGRES_PORT:=5432}\"\n: \"${POSTGRES_USER:=postgres}\"\n: \"${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}\"\n\nuntil PGPASSWORD=\"$POSTGRES_PASSWORD\" pg_isready -h \"$POSTGRES_HOST\" -p \"$POSTGRES_PORT\" -U \"$POSTGRES_USER\" >/dev/null 2>&1; do\n  echo \"Waiting for Postgres at ${POSTGRES_HOST}:${POSTGRES_PORT}...\"\n  sleep 2\ndone\n\nexec uvicorn main:app --host 0.0.0.0 --port 8000\nEOF\n\ncat <<'EOF' > backend.Dockerfile\nFROM python:3.11-slim\n\nWORKDIR /app\nENV PYTHONDONTWRITEBYTECODE=1\nENV PYTHONUNBUFFERED=1\n\nRUN apt-get update && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/*\n\n# Copy full backend source tree (routes, models, schemas, scripts, etc.)\nCOPY repo/backend /app\n\nRUN pip install --no-cache-dir -r requirements.txt\nRUN chmod +x /app/wait-for-postgres.sh\n\nCMD [\"/app/wait-for-postgres.sh\"]\nEOF\n\ncat <<'EOF' > docker-compose.yml\nversion: '3.8'\n\nx-logging:\n  &default-logging\n  logging:\n    driver: json-file\n    options:\n      max-size: 100m\n\nservices:\n  postgres:\n    image: postgres:13\n    env_file: .env\n    environment:\n      POSTGRES_USER: ${POSTGRES_USER}\n      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}\n      POSTGRES_DB: ${POSTGRES_DB}\n    restart: always\n    volumes:\n      - postgres-data:/var/lib/postgresql/data\n      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql:ro\n    healthcheck:\n      test: [\"CMD-SHELL\", \"pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}\"]\n      interval: 10s\n      timeout: 5s\n      retries: 12\n    <<: *default-logging\n\n  redis:\n    image: redis:6.0\n    env_file: .env\n    command: [\"redis-server\", \"--requirepass\", \"${REDIS_PASSWORD}\"]\n    restart: always\n    volumes:\n      - redis-data:/data\n    healthcheck:\n      test: [\"CMD-SHELL\", \"redis-cli -a ${REDIS_PASSWORD} ping | grep PONG\"]\n      interval: 10s\n      timeout: 5s\n      retries: 12\n    <<: *default-logging\n\n  judge0-server:\n    image: judge0/judge0:1.13.1\n    env_file: .env\n    ports:\n      - \"2358:2358\"\n    restart: always\n    privileged: true\n    depends_on:\n      - postgres\n      - redis\n    <<: *default-logging\n\n  judge0-worker:\n    image: judge0/judge0:1.13.1\n    command: [\"./scripts/workers\"]\n    env_file: .env\n    restart: always\n    privileged: true\n    depends_on:\n      - postgres\n      - redis\n    <<: *default-logging\n\n  backend:\n    build:\n      context: .\n      dockerfile: backend.Dockerfile\n    env_file: .env\n    environment:\n      DATABASE_URL: postgresql+psycopg2://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${CODINGPLATFORM_DB}\n      DB_HOST: postgres\n      DB_PORT: 5432\n      DB_NAME: ${CODINGPLATFORM_DB}\n      DB_USER: ${POSTGRES_USER}\n      DB_PASSWORD: ${POSTGRES_PASSWORD}\n      JUDGE0_BASE_URL: http://judge0-server:2358\n      JUDGE0_PROXY_TOKEN: ${JUDGE0_PROXY_TOKEN}\n      JWT_SECRET_KEY: ${JWT_SECRET_KEY}\n      ADMIN_SEED_KEY: ${ADMIN_SEED_KEY}\n    ports:\n      - \"8000:8000\"\n    restart: always\n    depends_on:\n      - postgres\n      - judge0-server\n    <<: *default-logging\n\nvolumes:\n  postgres-data:\n  redis-data:\nEOF\n\n# Nginx reverse proxy: public :80 -> backend :8000\ncat <<'EOF' > /etc/nginx/sites-available/default\nserver {\n    listen 80 default_server;\n    listen [::]:80 default_server;\n    server_name _;\n\n    location / {\n        proxy_pass http://127.0.0.1:8000;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n}\nEOF\n\nsystemctl enable nginx\nsystemctl restart nginx\n\nchown -R ubuntu:ubuntu $WORKDIR\n\ncd $WORKDIR\n\n# Bring infra up first.\ndocker-compose up -d postgres redis\n\nfor i in $(seq 1 60); do\n  if docker-compose exec -T postgres pg_isready -U postgres -d judge0 >/dev/null 2>&1; then\n    break\n  fi\n  sleep 2\ndone\n\n# Ensure codingplatform DB exists even when postgres volume already exists.\ndocker-compose exec -T postgres psql -U postgres -d postgres -tc \"SELECT 1 FROM pg_database WHERE datname='codingplatform'\" | grep -q 1 || \\\n  docker-compose exec -T postgres psql -U postgres -d postgres -c \"CREATE DATABASE codingplatform;\"\n\ndocker-compose up -d judge0-server judge0-worker\ndocker-compose up -d --build backend\n\n# One-time schema bootstrap for platform tables.\ndocker-compose exec -T backend python -c \"from sqlalchemy import create_engine; from models import Base; from database import build_database_url; engine = create_engine(build_database_url(), pool_pre_ping=True); Base.metadata.create_all(bind=engine)\"\n"
        }
      },
      "DependsOn": [
        "CodingPlatformInstanceInstanceRoleEA041D20"
      ],
      "Metadata": {
        "aws:cdk:path": "CodingPlatformEc2Stack/CodingPlatformInstance/Resource"
      }
    },
    "CDKMetadata": {
      "Type": "AWS::CDK::Metadata",
      "Properties": {
        "Analytics": "v2:deflate64:H4sIAAAAAAAA/1WOQW+DMAyFf0vvId3opJ6rHqqeGsHU62QyV/UKDkpsIYT47xOFDu3k5+/Zfs5t/rG3bxvoUua/H1lNlR1KAf8wxxs7iNCgYDTQpa8BfW6Ha+sn6+qOxmlVky+1YpSJraoIKvgJVY0rX9khpeAJhAL/DU/izIKRUU4g2EG/xCzdQQT8vUEWU6LXSNKfYtD2GfAPnDkJsF9Ozno0BI0dijB/9Kov28VwoxrH0RSYgsZ5+aLSqozG9XIPvN3Z953db34SURaVhRq0xVx/AYBgIq1HAQAA"
      },
      "Metadata": {
        "aws:cdk:path": "CodingPlatformEc2Stack/CDKMetadata/Default"
      },
      "Condition": "CDKMetadataAvailable"
    }
  },
  "Outputs": {
    "InstancePublicIp": {
      "Description": "Public IP of the EC2 instance",
      "Value": {
        "Fn::GetAtt": [
          "CodingPlatformInstanceD142B75D9a342d9b9fbff256",
          "PublicIp"
        ]
      }
    },
    "InstanceId": {
      "Description": "Instance ID",
      "Value": {
        "Ref": "CodingPlatformInstanceD142B75D9a342d9b9fbff256"
      }
    },
    "InstancePublicDnsName": {
      "Description": "Public DNS name of the EC2 instance",
      "Value": {
        "Fn::GetAtt": [
          "CodingPlatformInstanceD142B75D9a342d9b9fbff256",
          "PublicDnsName"
        ]
      }
    }
  },
  "Conditions": {
    "CDKMetadataAvailable": {
      "Fn::Or": [
        {
          "Fn::Or": [
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "af-south-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "ap-east-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "ap-northeast-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "ap-northeast-2"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "ap-northeast-3"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "ap-south-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "ap-south-2"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "ap-southeast-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "ap-southeast-2"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "ap-southeast-3"
              ]
            }
          ]
        },
        {
          "Fn::Or": [
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "ap-southeast-4"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "ca-central-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "ca-west-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "cn-north-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "cn-northwest-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "eu-central-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "eu-central-2"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "eu-north-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "eu-south-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "eu-south-2"
              ]
            }
          ]
        },
        {
          "Fn::Or": [
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "eu-west-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "eu-west-2"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "eu-west-3"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "il-central-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "me-central-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "me-south-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "sa-east-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "us-east-1"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "us-east-2"
              ]
            },
            {
              "Fn::Equals": [
                {
                  "Ref": "AWS::Region"
                },
                "us-west-1"
              ]
            }
          ]
        },
        {
          "Fn::Equals": [
            {
              "Ref": "AWS::Region"
            },
            "us-west-2"
          ]
        }
      ]
    }
  },
  "Rules": {
    "CheckBootstrapVersion": {
      "Assertions": [
        {
          "Assert": {
            "Fn::Not": [
              {
                "Fn::Contains": [
                  [
                    "1",
                    "2",
                    "3",
                    "4",
                    "5"
                  ],
                  {
                    "Ref": "BootstrapVersion"
                  }
                ]
              }
            ]
          },
          "AssertDescription": "CDK bootstrap stack version 6 required. Please run 'cdk bootstrap' with a recent version of the CDK CLI."
        }
      ]
    }
  }
}