import * as cdk from 'aws-cdk-lib/core';
import { LambdaConfig } from '../types/lambdaConfig';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecsp from 'aws-cdk-lib/aws-ecs-patterns';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import path from 'path';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';


const lambdaConfigs: LambdaConfig[] = [
  { name: 'addTask',    method: 'POST' },
  { name: 'deleteTask', method: 'POST' },
  { name: 'listTasks',  method: 'GET', isBaseRoute: true  }
];

export class AwsDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Domain registration / SSL
    const friendlyDomain = 'dmt-cdk-aws-demo.com';
    const certificate = new acm.Certificate(this, 'uiSSLCertificate', {
      domainName: friendlyDomain,
      validation: acm.CertificateValidation.fromDns(),
    });

    const hostedZone = new route53.HostedZone(this, 'uiHostedZone', {
      zoneName: friendlyDomain
    });

    // vnet setup
    const vpc = new ec2.Vpc(this, 'vpc', {
      maxAzs: 2
    });

    const vpcEndpoint = new ec2.InterfaceVpcEndpoint(this, 'VpcEndpoint', {
      vpc,
      service: {
        name: `com.amazonaws.${cdk.Aws.REGION}.execute-api`,
        port: 443
      },
      privateDnsEnabled: true
    });

    // API Layer
    const lambdas = lambdaConfigs.map((config) => ({
      ...config,
      function: new lambda.Function(this, `${config.name}Function`, {
        vpc,
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname, `../src/${config.name}/dist`))
      })
    }));

    // API Management
    const apim = new apigateway.RestApi(this, 'taskListApi', {
      restApiName: 'taskListAPI',
      description: 'Functions for manipulating the task list',
      endpointTypes: [apigateway.EndpointType.PRIVATE],
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*'],
            conditions: {
              StringEquals: {
                "aws:SourceVpce": vpcEndpoint.vpcEndpointId
              }
            }
          })
        ]
      })
    });

    // Create the IAM Role for Fargate UI service
    const uiTaskRole = new iam.Role(this, 'UiTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Role assumed by Fargate tasks for UI service',
    });

    // Attach permissions for invoking the API Gateway
    uiTaskRole.addToPolicy(new iam.PolicyStatement({
      actions: ['execute-api:Invoke'],
      resources: [
        apim.arnForExecuteApi('GET', '/listTasks'),
        apim.arnForExecuteApi('POST', '/addTask'),
        apim.arnForExecuteApi('POST', '/deleteTask')
      ],  // API Gateway ARN
    }));

    // Lambda integrations on APIM
    for (const lambda of lambdas) {
      const integration = new apigateway.LambdaIntegration(lambda.function, { proxy: true });
      const apimResource = apim.root.addResource(lambda.name);
      apimResource.addMethod(lambda.method, integration);
    }

    // UI cluster + fargate
    const uiDockerImage = new DockerImageAsset(this, 'ui-image', {
      directory: path.join(__dirname, '../src/ui')
    });

    const uiFargate = new ecsp.ApplicationLoadBalancedFargateService(this, 'uiFargateService', {
      taskImageOptions: {
        image: ecs.ContainerImage.fromDockerImageAsset(uiDockerImage),
        containerPort: 3000,
        environment: {
          API_GATEWAY_URL: apim.url
        }
      },
      vpc,
      taskSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      },
      memoryLimitMiB: 512,
      cpu: 256,
      desiredCount: 1,
      minHealthyPercent: 100,
      publicLoadBalancer: true,
      certificate
    });

    new route53.ARecord(this, 'uiARecord', {
      recordName: 'www',
      zone: hostedZone,
      target: route53.RecordTarget
        .fromAlias(new route53targets.LoadBalancerTarget(uiFargate.loadBalancer))
    });
    
    // load balance because why not
    const uiLoadBalanceAutoScale = uiFargate.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 2,
    });
    
    uiLoadBalanceAutoScale.scaleOnCpuUtilization('cpuScaling', {
      targetUtilizationPercent: 95,
    });

    uiLoadBalanceAutoScale.scaleOnMemoryUtilization('memoryScaling', {
      targetUtilizationPercent: 85,
    });

    // Database
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
