import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsp from 'aws-cdk-lib/aws-ecs-patterns';
import path from 'path';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';

export class AwsDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const addTaskFunction = new lambda.Function(this, "addTaskFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, '../src/addTask/dist'))
    });

    const addTaskFunctionUrl = addTaskFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
    });

    new cdk.CfnOutput(this, "addTaskFunctionOutput", {
      value: addTaskFunctionUrl.url,
    });
    
    const uiDockerImage = new DockerImageAsset(this, 'ui-image', {
      directory: path.join(__dirname, '../src/ui')
    });

    const uiLoadBalancer = new ecsp.ApplicationLoadBalancedFargateService(this, 'uiFargateService', {
      taskImageOptions: {
        image: ecs.ContainerImage.fromDockerImageAsset(uiDockerImage),
      },
      memoryLimitMiB: 512,
      cpu: 256,
      desiredCount: 1,
      minHealthyPercent: 100,
      publicLoadBalancer: true
    });
    
    // load balance because why not
    const uiLoadBalanceAutoScale = uiLoadBalancer.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 2,
    });
    
    uiLoadBalanceAutoScale.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 95,
    });

    uiLoadBalanceAutoScale.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 85,
    });
  }
}
