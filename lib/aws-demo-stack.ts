import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecsp from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import path from 'path';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';

export class AwsDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'vpc', {
      maxAzs: 1
    });

    const addTaskFunction = new lambda.Function(this, "addTaskFunction", {
      vpc,
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
      vpc,
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
    
    uiLoadBalanceAutoScale.scaleOnCpuUtilization('cpuScaling', {
      targetUtilizationPercent: 95,
    });

    uiLoadBalanceAutoScale.scaleOnMemoryUtilization('memoryScaling', {
      targetUtilizationPercent: 85,
    });

    // const dbCluster = new rds.DatabaseCluster(this, 'dbCluster', {
    //   engine: rds.DatabaseClusterEngine.auroraPostgres({
    //     version: rds.AuroraPostgresEngineVersion.VER_15_12,
    //   }),
    //   vpc,
    //   serverlessV2MinCapacity: 0.5, // Minimum ACU (0.5 is the lowest for PostgreSQL)
    //   serverlessV2MaxCapacity: 1, // Maximum ACU (adjust based on your needs)
    // });
  }
}
