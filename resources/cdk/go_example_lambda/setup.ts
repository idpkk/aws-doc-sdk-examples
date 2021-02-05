#!/usr/bin/env node
import 'source-map-support/register';

import * as cdk from '@aws-cdk/core';
import * as cfn from '@aws-cdk/aws-cloudformation';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import { DynamoEventSource, SnsEventSource, SqsEventSource, SqsDlq } from '@aws-cdk/aws-lambda-event-sources';
import * as s3 from '@aws-cdk/aws-s3';
import * as nots from '@aws-cdk/aws-s3-notifications';
import * as sns from '@aws-cdk/aws-sns';
import * as subs from '@aws-cdk/aws-sns-subscriptions';
import * as sqs from '@aws-cdk/aws-sqs';
import * as path from 'path';
import { StreamViewType } from '@aws-cdk/aws-dynamodb';
import { EventType } from '@aws-cdk/aws-s3';
import { CfnOutput } from '@aws-cdk/core';

export class GoCdkStack extends cdk.Stack {
  /**
   * This code example uses the 
   * {@link https://docs.aws.amazon.com/cdk/latest/guide/home.html | AWS Cloud Development Kit}   
   * to create the following resources:
   *
   * - An Amazon S3 bucket
   * 
   * - An Amazon DynamoDB table
   * 
   * - An Amazon SNS topic
   * 
   * - An Amazon SQS queue
   *
   * In addition, this project creates AWS Lambda functions,
   * in Go, to detect the following events:
   *
   * - An object uploaded to the Amazon S3 bucket
   * 
   * - An item added to the Amazon DynamoDB table
   * 
   * - A message sent to the Amazon SNS topic
   * 
   * - A message sent to the Amazon SQS queue
   *
   * The go functions are in their respective sub-folders in `src`.
   *
   * @remarks
   * Copy the contents of this directory to your computer.
   * If you want to change CloudFormation stack name from the
   * current value `GoLambdaCdkStack`,
   * change that value in `cdk.json`, `bin/go-lambda-cdk.ts`, and `lib/go-lambda-cdk-stack.ts`
   * to the value you prefer.
   * 
   * You must run the following command to get the packages
   * that this CDK app requires:
   * 
   * `npm install`
   * 
   * You'll know you have all of the packages you need
   * if you can successfully execute the following command
   * to create a CloudFormation stack from this CDK app:
   * 
   * `cdk synth`
   * 
   * This creates the template `GoLambdaCdkStack.template.json`
   * (unless you've changed the stack name) in `cdk.out`.
   * 
   * If you encounter any errors running CDK commands,
   * see the
   * {@link https://docs.aws.amazon.com/cdk/latest/guide/troubleshooting.html#troubleshooting_toolkit | Troubleshooting common AWS CDK issues}
   * topic in the CDK developer guide.
   * 
   * Working with the CDK app
   * 
   * If you aren't familiar with the CDK, here are some common commands:
   * 
   * - `cdk deploy` deploy this stack to your default AWS account/region
   * - `cdk diff`   compare deployed stack with current state
   * - `cdk ls`     lists your CloudFormation stacks
   * - `cdk synth`  create a CloudFormation template in 
   * 
   * See {@link https://docs.aws.amazon.com/cdk/latest/guide/cli.html | CDK command}
   * topic in the CDK developer guide for details.
   * 
   * Getting information about the new resources
   * 
   * Once you deploy the application, it display the following information
   * that you can use to work with the created resources:
   * 
   * - The name of the resource
   * 
   * - The name of the Lambda function that handles the events from the resource
   * 
   * - The name of the Amazon CloudWatch log group to which print statements from the AWS Lambda function are sent
   *   
   * You can use the CLI to get information about the resources created by
   * the resulting CloudFormation template by running the following command,
   * where `STACK-NAME` is the name of your CloudFormation stack:
   * 
   * `aws cloudformation describe-stacks --stack-name STACK-NAME --query Stacks[0].Outputs --output text`
   * 
   * Testing the notifications
   * 
   * This project contains the following Windows batch and Bash script files that you can use 
   * to test the AWS Lambda functions by sending a JSON payload to the function specified on the command line:
   * 
   * - `DynamoDBRecord.bat`, `DynamoDBRecord.sh`: these scripts send the data in `dynamodb-payload.json`.
   * 
   * - `S3Record.bat`, `S3Record.sh`: these scripts send the data in `s3-payload.json`.
   * 
   * - `SNSRecord.bat`, `SNSRecord.sh`: these scripts send the data in `sns-payload.json`.
   * 
   * - `SQSRecord.sh`, `SQSRecord.bat`: these scripts send the data in `sqs-payload.json`.
   * 
   * @public
   */
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Amazon DynamoDB table with primary key id (string)
    const myTable = new dynamodb.Table(this, 'MyTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      stream: StreamViewType.NEW_IMAGE,
    });

    // Create Amazon Simple Storage Service (Amazon S3) bucket and give it a tag
    const myBucket = new s3.Bucket(this, "MyBucket",);
    cdk.Tags.of(myBucket).add('NameTag', 'MyBucket');

    // Create Amazon Simple Notification Service (Amazon SNS) topic
    const myTopic = new sns.Topic(this, 'MyTopic', {
      displayName: 'User subscription topic'
    });

    // Create Amazon Simple Queue Service (Amazon SQS) queue
    const myQueue = new sqs.Queue(this, 'MyNewQueue');

    // Subscribe a queue to the topic:
    const mySubscription = new subs.SqsSubscription(myQueue)
    myTopic.addSubscription(mySubscription);

    /* Create AWS Lambda functions for all sources:
       Note that on Windows you'll have to replace the functions with a ZIP file you create by:
       1. Navigating to code location
       2. Running from a Windows command prompt (where main is your handler name):
          a. set GOOS=linux
          b. set GOARCH=amd64
          c. set CGO_ENABLED=0
          d. go build -o main
          e. build-lambda-zip.exe -o main.zip main
          f. aws lambda update-function-code --function-name FUNCTION-NAME --zip-file fileb://main.zip
 
          You can get build-lambda-zip.exe from https://github.com/aws/aws-lambda-go/tree/master/cmd/build-lambda-zip.
    */

    // Dynamodb Lambda function:
    const myDynamoDbFunction = new lambda.Function(this, 'MyDynamoDBFunction', {
      runtime: lambda.Runtime.GO_1_X,
      handler: 'main',
      code: new lambda.AssetCode('src/dynamodb'), // Go source file is (relative to cdk.json): src/dynamodb/main.go
    });

    // Set up dead-letter queue for failed DynamoDB or Amazon SNS events
    const dlQueue = new sqs.Queue(this, 'MyDLQueue');

    // See
    //   https://docs.aws.amazon.com/cdk/api/latest/docs/aws-lambda-event-sources-readme.html
    // for information on Lambda event sources.

    // Configure Lambda function to handle events from DynamoDB table.
    myDynamoDbFunction.addEventSource(new DynamoEventSource(myTable, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      batchSize: 5,
      bisectBatchOnError: true,
      onFailure: new SqsDlq(dlQueue),
      retryAttempts: 10
    }));

    // Amazon S3 Lambda function
    const myS3Function = new lambda.Function(this, 'MyS3Function', {
      runtime: lambda.Runtime.GO_1_X,
      handler: 'main',
      code: new lambda.AssetCode('src/s3'), // Go source file is (relative to cdk.json): src/s3/main.go
    });

    // Configure Amazon S3 bucket to send notification events to Lambda function.
    myBucket.addEventNotification(EventType.OBJECT_CREATED, new nots.LambdaDestination(myS3Function))

    /* Test the function from the command line by sending a notification (this does not upload KEY-NAME to BUCKET-NAME) with:
          aws lambda invoke --function-name FUNCTION-NAME out \
          --payload '{ "Records":[ { "eventSource":"aws:s3", "eventTime":"1970-01-01T00:00:00.000Z", \
          "s3":{ "bucket":{ "name":"BUCKET-NAME" } }, \
          "object":{ "key":"KEY-NAME" } } ] }' --log-type Tail --query 'LogResult' --output text | base64 -d
       where:
         FUNCTION-NAME is the name of your Lambda function
         BUCKET-NAME is the name of the S3 bucket sending notifications to Lambda
         KEY-NAME is the name of the object uploaded to the bucket
    */

    // Amazon SNS Lambda function:
    const mySNSFunction = new lambda.Function(this, 'MySNSFunction', {
      runtime: lambda.Runtime.GO_1_X,
      handler: 'main',
      code: new lambda.AssetCode('src/sns'), // Go source file is (relative to cdk.json): src/sns/main.go
    });

    // Configure Lambda function to handle events from Amazon SNS topic.
    mySNSFunction.addEventSource(new SnsEventSource(myTopic, {
      filterPolicy: {
        Field: sns.SubscriptionFilter.stringFilter({  // See https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-sns.SubscriptionFilter.html
          whitelist: ['cat', 'dog'],  // Only include events that match 
        }),
      },
      deadLetterQueue: dlQueue,
    }));

    // Amazon SQS Lambda function:
    const mySQSFunction = new lambda.Function(this, 'MySQSFunction', {
      runtime: lambda.Runtime.GO_1_X,
      handler: 'main',
      code: new lambda.AssetCode('src/sqs'), // Go source file is (relative to cdk.json): src/sqs/main.go
    });

    // Configure Lambda function to handle events from SQS queue.
    mySQSFunction.addEventSource(new SqsEventSource(myQueue, {
      batchSize: 10, // default
    }));

    // Display info about the resources.
    // You can see this information at any time by running:
    //   aws cloudformation describe-stacks --stack-name GoCdkStack --query Stacks[0].Outputs --output text
    new CfnOutput(this, 'Bucket name: ', { value: myBucket.bucketName });
    new CfnOutput(this, 'S3 function name: ', { value: myS3Function.functionName });
    new CfnOutput(this, 'S3 function CloudWatch log group: ', { value: myS3Function.logGroup.logGroupName });

    new CfnOutput(this, 'Table name: ', { value: myTable.tableName });
    new CfnOutput(this, 'DynamoDB function name: ', { value: myDynamoDbFunction.functionName });
    new CfnOutput(this, 'DynamoDB function CloudWatch log group: ', { value: myDynamoDbFunction.logGroup.logGroupName });

    new CfnOutput(this, 'Topic name: ', { value: myTopic.topicName });
    new CfnOutput(this, 'SNS function name: ', { value: mySNSFunction.functionName });
    new CfnOutput(this, 'SNS function CloudWatch log group: ', { value: mySNSFunction.logGroup.logGroupName });

    new CfnOutput(this, 'Queue name: ', { value: myQueue.queueName });
    new CfnOutput(this, 'SQS function name: ', { value: mySQSFunction.functionName });
    new CfnOutput(this, 'SQS function CloudWatch log group: ', { value: mySQSFunction.logGroup.logGroupName });
  }
}

const app = new cdk.App();
new GoCdkStack(app, 'GoCdkStack');
