#!/usr/bin/env python3
import aws_cdk as cdk

from cdk_stack import CodingPlatformStack

app = cdk.App()
CodingPlatformStack(app, "CodingPlatformStackV2")
app.synth()
