#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { AwsDemoStack } from '../lib/aws-demo-stack';

const app = new cdk.App();
new AwsDemoStack(app, 'AwsDemoStack', {
  env: {
    account: '395043419572',
    region: 'us-east-1'
  }
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
