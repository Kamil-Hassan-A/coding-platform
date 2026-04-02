#!/usr/bin/env python3
import aws_cdk as cdk

# Old Fargate/ECS Stack
# from cdk_stack import CodingPlatformStack

# New single EC2 instance stack
from cdk_stack_ec2 import Ec2SingleInstanceStack

app = cdk.App()
# CodingPlatformStack(app, "CodingPlatformStackV2")
Ec2SingleInstanceStack(app, "CodingPlatformEc2Stack")
app.synth()
