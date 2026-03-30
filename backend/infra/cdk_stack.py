"""
AWS CDK Stack for the Coding Assessment Platform.

Creates:
- VPC with 2 public and 2 private subnets + NAT Gateway
- RDS PostgreSQL (db.t4g.micro) in private subnets
- Lambda function (Python 3.11) in private subnets
- ECS Fargate service for self-hosted Judge0 CE behind internal ALB
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
    aws_ecs as ecs,
    aws_efs as efs,
    aws_ecr as ecr,
    aws_elasticloadbalancingv2 as elbv2,
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
        # ECR Repositories for Judge0, Postgres, Redis
        # -----------------------------------------------------------
        judge0_ecr = ecr.Repository.from_repository_name(
            self,
            "Judge0Repo",
            "judge0",
        )

        # -----------------------------------------------------------
        # ECS Fargate for self-hosted Judge0 CE (internal)
        # -----------------------------------------------------------
        judge0_alb_sg = ec2.SecurityGroup(
            self,
            "Judge0AlbSG",
            vpc=vpc,
            description="Security group for internal Judge0 ALB",
            allow_all_outbound=True,
        )
        judge0_alb_sg.add_ingress_rule(
            peer=lambda_sg,
            connection=ec2.Port.tcp(2358),
            description="Allow Lambda to call Judge0 through ALB",
        )

        judge0_tasks_sg = ec2.SecurityGroup(
            self,
            "Judge0TasksSG",
            vpc=vpc,
            description="Security group for Judge0 Fargate tasks",
            allow_all_outbound=True,
        )
        judge0_tasks_sg.add_ingress_rule(
            peer=lambda_sg,
            connection=ec2.Port.tcp(2358),
            description="Allow Lambda to reach Judge0 tasks on port 2358",
        )
        judge0_tasks_sg.add_ingress_rule(
            peer=judge0_alb_sg,
            connection=ec2.Port.tcp(2358),
            description="Allow internal ALB to reach Judge0 tasks",
        )

        # Self-ingress on HTTPS so that tasks can reach VPC endpoints using this SG
        judge0_tasks_sg.add_ingress_rule(
            peer=judge0_tasks_sg,
            connection=ec2.Port.tcp(443),
            description="Allow VPC endpoint access from tasks within same SG",
        )

        # -----------------------------------------------------------
        # VPC Endpoints to bypass NAT Gateway for ECR/S3 pull
        # -----------------------------------------------------------
        vpc.add_gateway_endpoint(
            "S3GatewayEndpoint",
            service=ec2.GatewayVpcEndpointAwsService.S3,
            subnets=[ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS)],
        )

        vpc.add_interface_endpoint(
            "EcrDockerEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[judge0_tasks_sg],
        )

        vpc.add_interface_endpoint(
            "EcrApiEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.ECR,
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[judge0_tasks_sg],
        )

        judge0_efs_sg = ec2.SecurityGroup(
            self,
            "Judge0EfsSG",
            vpc=vpc,
            description="Security group for Judge0 EFS",
            allow_all_outbound=True,
        )
        judge0_efs_sg.add_ingress_rule(
            peer=judge0_tasks_sg,
            connection=ec2.Port.tcp(2049),
            description="Allow NFS from Judge0 ECS tasks",
        )

        judge0_efs = efs.FileSystem(
            self,
            "Judge0Efs",
            vpc=vpc,
            encrypted=True,
            security_group=judge0_efs_sg,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
            ),
            removal_policy=RemovalPolicy.DESTROY,
        )

        postgres_access_point = efs.AccessPoint(
            self,
            "Judge0PostgresAccessPoint",
            file_system=judge0_efs,
            path="/judge0-postgres",
            create_acl=efs.Acl(
                owner_gid="999",
                owner_uid="999",
                permissions="750",
            ),
            posix_user=efs.PosixUser(uid="999", gid="999"),
        )

        judge0_postgres_password_secret = secretsmanager.Secret(
            self,
            "Judge0PostgresPasswordSecret",
            secret_name="coding-platform/judge0/postgres-password",
            generate_secret_string=secretsmanager.SecretStringGenerator(
                secret_string_template='{"username":"judge0"}',
                generate_string_key="password",
                exclude_punctuation=True,
                include_space=False,
                password_length=30,
            ),
        )

        judge0_redis_password_secret = secretsmanager.Secret(
            self,
            "Judge0RedisPasswordSecret",
            secret_name="coding-platform/judge0/redis-password",
            generate_secret_string=secretsmanager.SecretStringGenerator(
                secret_string_template='{"username":"judge0-redis"}',
                generate_string_key="password",
                exclude_punctuation=True,
                include_space=False,
                password_length=30,
            ),
        )

        judge0_cluster = ecs.Cluster(
            self,
            "Judge0Cluster",
            vpc=vpc,
            cluster_name="judge0-cluster",
        )

        judge0_task_execution_role = iam.Role(
            self,
            "Judge0TaskExecutionRole",
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AmazonECSTaskExecutionRolePolicy"
                )
            ],
            description="Execution role for Judge0 Fargate tasks",
        )

        judge0_task_role = iam.Role(
            self,
            "Judge0TaskRole",
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            description="Task role for Judge0 containers",
        )

        judge0_task_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "elasticfilesystem:ClientMount",
                    "elasticfilesystem:ClientWrite",
                    "elasticfilesystem:ClientRootAccess",
                ],
                resources=[
                    judge0_efs.file_system_arn,
                    postgres_access_point.access_point_arn,
                ],
            )
        )

        judge0_postgres_password_secret.grant_read(judge0_task_execution_role)
        judge0_postgres_password_secret.grant_read(judge0_task_role)
        judge0_redis_password_secret.grant_read(judge0_task_execution_role)
        judge0_redis_password_secret.grant_read(judge0_task_role)

        # Grant ECS Task Execution Role permissions to pull images from ECR
        judge0_ecr.grant_pull(judge0_task_execution_role)

        judge0_task_definition = ecs.FargateTaskDefinition(
            self,
            "Judge0TaskDefinition",
            cpu=1024,
            memory_limit_mib=2048,
            execution_role=judge0_task_execution_role,
            task_role=judge0_task_role,
        )

        judge0_task_definition.add_volume(
            name="judge0-efs-postgres",
            efs_volume_configuration=ecs.EfsVolumeConfiguration(
                file_system_id=judge0_efs.file_system_id,
                transit_encryption="ENABLED",
                authorization_config=ecs.AuthorizationConfig(
                    access_point_id=postgres_access_point.access_point_id,
                    iam="ENABLED",
                ),
            ),
        )

        judge0_postgres_container = judge0_task_definition.add_container(
            "judge0-postgres",
            image=ecs.ContainerImage.from_registry("public.ecr.aws/docker/library/postgres:16"),
            logging=ecs.LogDrivers.aws_logs(stream_prefix="judge0-postgres"),
            environment={
                "POSTGRES_USER": "judge0",
                "POSTGRES_DB": "judge0",
            },
            secrets={
                "POSTGRES_PASSWORD": ecs.Secret.from_secrets_manager(
                    judge0_postgres_password_secret,
                    field="password",
                ),
            },
            health_check=ecs.HealthCheck(
                command=["CMD-SHELL", "pg_isready -U judge0 -d judge0"],
                interval=Duration.seconds(10),
                timeout=Duration.seconds(5),
                start_period=Duration.seconds(60),
                retries=5,
            ),
        )
        judge0_postgres_container.add_mount_points(
            ecs.MountPoint(
                source_volume="judge0-efs-postgres",
                container_path="/var/lib/postgresql/data",
                read_only=False,
            )
        )

        judge0_redis_container = judge0_task_definition.add_container(
            "judge0-redis",
            image=ecs.ContainerImage.from_registry("public.ecr.aws/docker/library/redis:7"),
            logging=ecs.LogDrivers.aws_logs(stream_prefix="judge0-redis"),
            command=["sh", "-c", 'exec redis-server --requirepass "$REDIS_PASSWORD"'],
            secrets={
                "REDIS_PASSWORD": ecs.Secret.from_secrets_manager(
                    judge0_redis_password_secret,
                    field="password",
                ),
            },
            health_check=ecs.HealthCheck(
                command=["CMD-SHELL", 'redis-cli -a "$REDIS_PASSWORD" ping'],
                interval=Duration.seconds(10),
                timeout=Duration.seconds(5),
                start_period=Duration.seconds(30),
                retries=5,
            ),
        )

        judge0_common_env = {
            "POSTGRES_HOST": "127.0.0.1",
            "POSTGRES_USER": "judge0",
            "POSTGRES_DB": "judge0",
            "REDIS_HOST": "127.0.0.1",
            "RAILS_ENV": "production",
            "JUDGE0_API_URL": "http://127.0.0.1:2358",
        }
        judge0_common_secrets = {
            "POSTGRES_PASSWORD": ecs.Secret.from_secrets_manager(
                judge0_postgres_password_secret,
                field="password",
            ),
            "REDIS_PASSWORD": ecs.Secret.from_secrets_manager(
                judge0_redis_password_secret,
                field="password",
            ),
        }

        judge0_server_container = judge0_task_definition.add_container(
            "judge0-server",
            image=ecs.ContainerImage.from_ecr_repository(judge0_ecr, "1.13.1"),
            logging=ecs.LogDrivers.aws_logs(stream_prefix="judge0-server"),
            environment=judge0_common_env,
            secrets=judge0_common_secrets,
        )
        judge0_server_container.add_port_mappings(
            ecs.PortMapping(container_port=2358, protocol=ecs.Protocol.TCP)
        )
        judge0_server_container.add_container_dependencies(
            ecs.ContainerDependency(
                container=judge0_postgres_container,
                condition=ecs.ContainerDependencyCondition.HEALTHY,
            ),
            ecs.ContainerDependency(
                container=judge0_redis_container,
                condition=ecs.ContainerDependencyCondition.HEALTHY,
            )
        )

        judge0_worker_container = judge0_task_definition.add_container(
            "judge0-worker",
            image=ecs.ContainerImage.from_ecr_repository(judge0_ecr, "1.13.1"),
            logging=ecs.LogDrivers.aws_logs(stream_prefix="judge0-worker"),
            command=["bash", "-lc", "bundle exec rake jobs:work"],
            environment=judge0_common_env,
            secrets=judge0_common_secrets,
        )
        judge0_worker_container.add_container_dependencies(
            ecs.ContainerDependency(
                container=judge0_postgres_container,
                condition=ecs.ContainerDependencyCondition.HEALTHY,
            ),
            ecs.ContainerDependency(
                container=judge0_redis_container,
                condition=ecs.ContainerDependencyCondition.HEALTHY,
            )
        )

        judge0_task_definition.node.add_dependency(judge0_efs)
        judge0_task_definition.node.add_dependency(postgres_access_point)

        judge0_service = ecs.FargateService(
            self,
            "Judge0Service",
            cluster=judge0_cluster,
            task_definition=judge0_task_definition,
            desired_count=1,
            assign_public_ip=False,
            security_groups=[judge0_tasks_sg],
            health_check_grace_period=Duration.minutes(5),
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
            ),
        )

        judge0_alb = elbv2.ApplicationLoadBalancer(
            self,
            "Judge0InternalAlb",
            vpc=vpc,
            internet_facing=False,
            security_group=judge0_alb_sg,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
            ),
            load_balancer_name="judge0-internal-alb",
        )

        judge0_listener = judge0_alb.add_listener(
            "Judge0Listener",
            port=2358,
            protocol=elbv2.ApplicationProtocol.HTTP,
            open=False,
        )

        judge0_listener.add_targets(
            "Judge0FargateTargets",
            port=2358,
            protocol=elbv2.ApplicationProtocol.HTTP,
            targets=[
                judge0_service.load_balancer_target(
                    container_name="judge0-server",
                    container_port=2358,
                )
            ],
            health_check=elbv2.HealthCheck(
                enabled=True,
                path="/",
                interval=Duration.seconds(30),
                timeout=Duration.seconds(10),
                healthy_threshold_count=2,
                unhealthy_threshold_count=5,
                healthy_http_codes="200-499",
            ),
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

        backend_lambda.add_environment(
            "JUDGE0_BASE_URL",
            f"http://{judge0_alb.load_balancer_dns_name}:2358",
        )

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
            "Judge0AlbDnsName",
            value=judge0_alb.load_balancer_dns_name,
            description="Internal ALB DNS name for Judge0 CE",
        )

        CfnOutput(
            self,
            "Judge0EcrUri",
            value=judge0_ecr.repository_uri,
            description="ECR Repository URI for Judge0 CE",
        )
