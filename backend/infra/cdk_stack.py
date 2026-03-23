"""
AWS CDK Stack for the Coding Assessment Platform.

Creates:
- VPC with 2 public and 2 private subnets + NAT Gateway
- RDS PostgreSQL (db.t4g.micro) in private subnets
- Lambda function (Python 3.11) in private subnets
- EC2 instance for self-hosted Judge0 CE
- HTTP API Gateway with {proxy+} route
- Secrets Manager secret for RDS credentials
"""

import aws_cdk as cdk
from aws_cdk import (
    Stack,
    CfnOutput,
    Duration,
    RemovalPolicy,
    aws_ec2 as ec2,
    aws_rds as rds,
    aws_lambda as _lambda,
    aws_secretsmanager as secretsmanager,
    aws_apigatewayv2 as apigwv2,
    aws_apigatewayv2_integrations as apigwv2_integrations,
    aws_iam as iam,
)
from constructs import Construct


class CodingPlatformStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # -----------------------------------------------------------
        # VPC — 2 public subnets + 2 private subnets with NAT Gateway
        # -----------------------------------------------------------
        vpc = ec2.Vpc(
            self,
            "CodingPlatformVpc",
            max_azs=2,
            nat_gateways=1,
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="Public",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24,
                ),
                ec2.SubnetConfiguration(
                    name="Private",
                    subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidr_mask=24,
                ),
            ],
        )

        # -----------------------------------------------------------
        # Security Groups
        # -----------------------------------------------------------
        lambda_sg = ec2.SecurityGroup(
            self,
            "LambdaSG",
            vpc=vpc,
            description="Security group for Lambda function",
            allow_all_outbound=True,
        )

        rds_sg = ec2.SecurityGroup(
            self,
            "RdsSG",
            vpc=vpc,
            description="Security group for RDS PostgreSQL",
            allow_all_outbound=False,
        )

        # Allow Lambda → RDS on PostgreSQL port
        rds_sg.add_ingress_rule(
            peer=lambda_sg,
            connection=ec2.Port.tcp(5432),
            description="Allow Lambda to connect to RDS PostgreSQL",
        )

        # -----------------------------------------------------------
        # Secrets Manager — RDS master credentials
        # -----------------------------------------------------------
        db_secret = secretsmanager.Secret(
            self,
            "DbSecret",
            secret_name="coding-platform/db-credentials",
            generate_secret_string=secretsmanager.SecretStringGenerator(
                secret_string_template='{"username": "dbadmin"}',
                generate_string_key="password",
                exclude_punctuation=True,
                include_space=False,
                password_length=30,
            ),
        )

        # -----------------------------------------------------------
        # RDS PostgreSQL — db.t4g.micro in private subnets
        # -----------------------------------------------------------
        db_instance = rds.DatabaseInstance(
            self,
            "CodingPlatformDb",
            engine=rds.DatabaseInstanceEngine.postgres(
                version=rds.PostgresEngineVersion.VER_15,
            ),
            instance_type=ec2.InstanceType.of(
                ec2.InstanceClass.T4G,
                ec2.InstanceSize.MICRO,
            ),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
            ),
            security_groups=[rds_sg],
            credentials=rds.Credentials.from_secret(db_secret),
            database_name="codingplatform",
            allocated_storage=20,
            max_allocated_storage=100,
            removal_policy=RemovalPolicy.DESTROY,
            deletion_protection=False,
            publicly_accessible=False,
        )

        # -----------------------------------------------------------
        # Lambda Function — Python 3.11, in private subnets
        # -----------------------------------------------------------
        backend_lambda = _lambda.Function(
            self,
            "BackendLambda",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="main.handler",
            code=_lambda.Code.from_asset(
                "..",
                exclude=[
                    "infra",
                    "infra/**",
                    "__pycache__",
                    "**/__pycache__/**",
                ],
            ),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
            ),
            security_groups=[lambda_sg],
            memory_size=512,
            timeout=Duration.seconds(30),
            environment={
                "DB_SECRET_ARN": db_secret.secret_arn,
                "DB_HOST": db_instance.db_instance_endpoint_address,
                "DB_PORT": db_instance.db_instance_endpoint_port,
                "DB_NAME": "codingplatform",
            },
        )

        # -----------------------------------------------------------
        # IAM — Grant Lambda permissions
        # -----------------------------------------------------------
        # Read the database secret
        db_secret.grant_read(backend_lambda)

        # Allow rds-db:connect for IAM authentication (optional)
        backend_lambda.add_to_role_policy(
            iam.PolicyStatement(
                actions=["rds-db:connect"],
                resources=[
                    f"arn:aws:rds-db:{self.region}:{self.account}:dbuser:*/*"
                ],
            )
        )

        

        # -----------------------------------------------------------
        # EC2 for self-hosted Judge0 CE
        # -----------------------------------------------------------
        judge0_sg = ec2.SecurityGroup(
            self,
            "Judge0Ec2SG",
            vpc=vpc,
            description="Security group for Judge0 CE EC2 host",
            allow_all_outbound=True,
        )

        # Restrict inbound traffic to this VPC only.
        judge0_sg.add_ingress_rule(
            peer=ec2.Peer.ipv4(vpc.vpc_cidr_block),
            connection=ec2.Port.tcp(22),
            description="Allow SSH only from VPC",
        )
        judge0_sg.add_ingress_rule(
            peer=ec2.Peer.ipv4(vpc.vpc_cidr_block),
            connection=ec2.Port.tcp(80),
            description="Allow HTTP only from VPC",
        )
        judge0_sg.add_ingress_rule(
            peer=ec2.Peer.ipv4(vpc.vpc_cidr_block),
            connection=ec2.Port.tcp(443),
            description="Allow HTTPS only from VPC",
        )
        judge0_sg.add_ingress_rule(
            peer=ec2.Peer.ipv4(vpc.vpc_cidr_block),
            connection=ec2.Port.tcp(2358),
            description="Allow Judge0 API only from VPC",
        )

        judge0_role = iam.Role(
            self,
            "Judge0Ec2Role",
            assumed_by=iam.ServicePrincipal("ec2.amazonaws.com"),
            description="IAM role for Judge0 CE EC2 host",
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("CloudWatchAgentServerPolicy"),
            ],
        )

        judge0_instance = ec2.Instance(
            self,
            "Judge0Ec2Instance",
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
            ),
            security_group=judge0_sg,
            role=judge0_role,
            instance_type=ec2.InstanceType("t3.small"),
            machine_image=ec2.MachineImage.latest_amazon_linux2(),
        )

        judge0_instance.add_user_data(
            "#!/bin/bash",
            "set -euxo pipefail",
            "yum update -y",
            "amazon-linux-extras install docker -y",
            "systemctl enable docker",
            "systemctl start docker",
            "usermod -aG docker ec2-user",
            "curl -L \"https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64\" -o /usr/local/bin/docker-compose",
            "chmod +x /usr/local/bin/docker-compose",
            "ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose",
        )

        # -----------------------------------------------------------
        # HTTP API Gateway — proxy route to Lambda
        # -----------------------------------------------------------
        http_api = apigwv2.HttpApi(
            self,
            "CodingPlatformApi",
            api_name="CodingPlatformApi",
            description="HTTP API for the Coding Assessment Platform",
        )

        backend_lambda.add_environment("JUDGE0_BASE_URL", f"http://{judge0_instance.instance_private_ip}:2358")

        lambda_integration = apigwv2_integrations.HttpLambdaIntegration(
            "LambdaIntegration",
            handler=backend_lambda,
        )

        http_api.add_routes(
            path="/{proxy+}",
            methods=[apigwv2.HttpMethod.ANY],
            integration=lambda_integration,
        )

        # Also handle root path
        http_api.add_routes(
            path="/",
            methods=[apigwv2.HttpMethod.ANY],
            integration=lambda_integration,
        )

        # -----------------------------------------------------------
        # Outputs
        # -----------------------------------------------------------
        CfnOutput(
            self,
            "ApiGatewayUrl",
            value=http_api.url or "",
            description="HTTP API Gateway URL",
        )

        CfnOutput(
            self,
            "DbSecretArn",
            value=db_secret.secret_arn,
            description="ARN of the database credentials secret",
        )

        CfnOutput(
            self,
            "Judge0InstanceId",
            value=judge0_instance.instance_id,
            description="EC2 instance ID for self-hosted Judge0 CE",
        )

        CfnOutput(
            self,
            "Judge0PrivateIp",
            value=judge0_instance.instance_private_ip,
            description="Private IP of self-hosted Judge0 CE host",
        )
