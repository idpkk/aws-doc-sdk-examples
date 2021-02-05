#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoCdkStack = void 0;
require("source-map-support/register");
const cdk = require("@aws-cdk/core");
const dynamodb = require("@aws-cdk/aws-dynamodb");
const lambda = require("@aws-cdk/aws-lambda");
const aws_lambda_event_sources_1 = require("@aws-cdk/aws-lambda-event-sources");
const s3 = require("@aws-cdk/aws-s3");
const nots = require("@aws-cdk/aws-s3-notifications");
const sns = require("@aws-cdk/aws-sns");
const subs = require("@aws-cdk/aws-sns-subscriptions");
const sqs = require("@aws-cdk/aws-sqs");
const aws_dynamodb_1 = require("@aws-cdk/aws-dynamodb");
const aws_s3_1 = require("@aws-cdk/aws-s3");
const core_1 = require("@aws-cdk/core");
class GoCdkStack extends cdk.Stack {
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
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create Amazon DynamoDB table with primary key id (string)
        const myTable = new dynamodb.Table(this, 'MyTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            stream: aws_dynamodb_1.StreamViewType.NEW_IMAGE,
        });
        // Create Amazon Simple Storage Service (Amazon S3) bucket and give it a tag
        const myBucket = new s3.Bucket(this, "MyBucket");
        cdk.Tags.of(myBucket).add('NameTag', 'MyBucket');
        // Create Amazon Simple Notification Service (Amazon SNS) topic
        const myTopic = new sns.Topic(this, 'MyTopic', {
            displayName: 'User subscription topic'
        });
        // Create Amazon Simple Queue Service (Amazon SQS) queue
        const myQueue = new sqs.Queue(this, 'MyNewQueue');
        // Subscribe a queue to the topic:
        const mySubscription = new subs.SqsSubscription(myQueue);
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
            code: new lambda.AssetCode('src/dynamodb'),
        });
        // Set up dead-letter queue for failed DynamoDB or Amazon SNS events
        const dlQueue = new sqs.Queue(this, 'MyDLQueue');
        // See
        //   https://docs.aws.amazon.com/cdk/api/latest/docs/aws-lambda-event-sources-readme.html
        // for information on Lambda event sources.
        // Configure Lambda function to handle events from DynamoDB table.
        myDynamoDbFunction.addEventSource(new aws_lambda_event_sources_1.DynamoEventSource(myTable, {
            startingPosition: lambda.StartingPosition.TRIM_HORIZON,
            batchSize: 5,
            bisectBatchOnError: true,
            onFailure: new aws_lambda_event_sources_1.SqsDlq(dlQueue),
            retryAttempts: 10
        }));
        // Amazon S3 Lambda function
        const myS3Function = new lambda.Function(this, 'MyS3Function', {
            runtime: lambda.Runtime.GO_1_X,
            handler: 'main',
            code: new lambda.AssetCode('src/s3'),
        });
        // Configure Amazon S3 bucket to send notification events to Lambda function.
        myBucket.addEventNotification(aws_s3_1.EventType.OBJECT_CREATED, new nots.LambdaDestination(myS3Function));
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
            code: new lambda.AssetCode('src/sns'),
        });
        // Configure Lambda function to handle events from Amazon SNS topic.
        mySNSFunction.addEventSource(new aws_lambda_event_sources_1.SnsEventSource(myTopic, {
            filterPolicy: {
                Field: sns.SubscriptionFilter.stringFilter({
                    whitelist: ['cat', 'dog'],
                }),
            },
            deadLetterQueue: dlQueue,
        }));
        // Amazon SQS Lambda function:
        const mySQSFunction = new lambda.Function(this, 'MySQSFunction', {
            runtime: lambda.Runtime.GO_1_X,
            handler: 'main',
            code: new lambda.AssetCode('src/sqs'),
        });
        // Configure Lambda function to handle events from SQS queue.
        mySQSFunction.addEventSource(new aws_lambda_event_sources_1.SqsEventSource(myQueue, {
            batchSize: 10,
        }));
        // Display info about the resources.
        // You can see this information at any time by running:
        //   aws cloudformation describe-stacks --stack-name GoCdkStack --query Stacks[0].Outputs --output text
        new core_1.CfnOutput(this, 'Bucket name: ', { value: myBucket.bucketName });
        new core_1.CfnOutput(this, 'S3 function name: ', { value: myS3Function.functionName });
        new core_1.CfnOutput(this, 'S3 function CloudWatch log group: ', { value: myS3Function.logGroup.logGroupName });
        new core_1.CfnOutput(this, 'Table name: ', { value: myTable.tableName });
        new core_1.CfnOutput(this, 'DynamoDB function name: ', { value: myDynamoDbFunction.functionName });
        new core_1.CfnOutput(this, 'DynamoDB function CloudWatch log group: ', { value: myDynamoDbFunction.logGroup.logGroupName });
        new core_1.CfnOutput(this, 'Topic name: ', { value: myTopic.topicName });
        new core_1.CfnOutput(this, 'SNS function name: ', { value: mySNSFunction.functionName });
        new core_1.CfnOutput(this, 'SNS function CloudWatch log group: ', { value: mySNSFunction.logGroup.logGroupName });
        new core_1.CfnOutput(this, 'Queue name: ', { value: myQueue.queueName });
        new core_1.CfnOutput(this, 'SQS function name: ', { value: mySQSFunction.functionName });
        new core_1.CfnOutput(this, 'SQS function CloudWatch log group: ', { value: mySQSFunction.logGroup.logGroupName });
    }
}
exports.GoCdkStack = GoCdkStack;
const app = new cdk.App();
new GoCdkStack(app, 'GoCdkStack');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dXAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZXR1cC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7O0FBQ0EsdUNBQXFDO0FBRXJDLHFDQUFxQztBQUVyQyxrREFBa0Q7QUFDbEQsOENBQThDO0FBQzlDLGdGQUE4RztBQUM5RyxzQ0FBc0M7QUFDdEMsc0RBQXNEO0FBQ3RELHdDQUF3QztBQUN4Qyx1REFBdUQ7QUFDdkQsd0NBQXdDO0FBRXhDLHdEQUF1RDtBQUN2RCw0Q0FBNEM7QUFDNUMsd0NBQTBDO0FBRTFDLE1BQWEsVUFBVyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3ZDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztPQStGRztJQUNILFlBQVksS0FBb0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDbEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsNERBQTREO1FBQzVELE1BQU0sT0FBTyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFO1lBQ2xELFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQ2pFLE1BQU0sRUFBRSw2QkFBYyxDQUFDLFNBQVM7U0FDakMsQ0FBQyxDQUFDO1FBRUgsNEVBQTRFO1FBQzVFLE1BQU0sUUFBUSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFFLENBQUM7UUFDbEQsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUVqRCwrREFBK0Q7UUFDL0QsTUFBTSxPQUFP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Q0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO1FBQ2xGLElBQUksZ0JBQVMsQ0FBQyxJQUFJLEVBQUUscUNBQXFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsYUFBYSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO1FBRTNHLElBQUksZ0JBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBQ2xFLElBQUksZ0JBQVMsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUUsRUFBRSxLQUFLLEVBQUUsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7UUFDbEYsSUFBSSxnQkFBUyxDQUFDLElBQUksRUFBRSxxQ0FBcUMsRUFBRSxFQUFFLEtBQUssRUFBRSxhQUFhLENBQUMsUUFBUSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7SUFDN0csQ0FBQztDQUNGO0FBcE9ELGdDQW9PQztBQUVELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBQzFCLElBQUksVUFBVSxDQUFDLEdBQUcsRUFBRSxZQUFZLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcclxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xyXG5cclxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xyXG5pbXBvcnQgKiBhcyBjZm4gZnJvbSAnQGF3cy1jZGsvYXdzLWNsb3VkZm9ybWF0aW9uJztcclxuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnQGF3cy1jZGsvYXdzLWR5bmFtb2RiJztcclxuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ0Bhd3MtY2RrL2F3cy1sYW1iZGEnO1xyXG5pbXBvcnQgeyBEeW5hbW9FdmVudFNvdXJjZSwgU25zRXZlbnRTb3VyY2UsIFNxc0V2ZW50U291cmNlLCBTcXNEbHEgfSBmcm9tICdAYXdzLWNkay9hd3MtbGFtYmRhLWV2ZW50LXNvdXJjZXMnO1xyXG5pbXBvcnQgKiBhcyBzMyBmcm9tICdAYXdzLWNkay9hd3MtczMnO1xyXG5pbXBvcnQgKiBhcyBub3RzIGZyb20gJ0Bhd3MtY2RrL2F3cy1zMy1ub3RpZmljYXRpb25zJztcclxuaW1wb3J0ICogYXMgc25zIGZyb20gJ0Bhd3MtY2RrL2F3cy1zbnMnO1xyXG5pbXBvcnQgKiBhcyBzdWJzIGZyb20gJ0Bhd3MtY2RrL2F3cy1zbnMtc3Vic2NyaXB0aW9ucyc7XHJcbmltcG9ydCAqIGFzIHNxcyBmcm9tICdAYXdzLWNkay9hd3Mtc3FzJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgU3RyZWFtVmlld1R5cGUgfSBmcm9tICdAYXdzLWNkay9hd3MtZHluYW1vZGInO1xyXG5pbXBvcnQgeyBFdmVudFR5cGUgfSBmcm9tICdAYXdzLWNkay9hd3MtczMnO1xyXG5pbXBvcnQgeyBDZm5PdXRwdXQgfSBmcm9tICdAYXdzLWNkay9jb3JlJztcclxuXHJcbmV4cG9ydCBjbGFzcyBHb0Nka1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcclxuICAvKipcclxuICAgKiBUaGlzIGNvZGUgZXhhbXBsZSB1c2VzIHRoZSBcclxuICAgKiB7QGxpbmsgaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL2Nkay9sYXRlc3QvZ3VpZGUvaG9tZS5odG1sIHwgQVdTIENsb3VkIERldmVsb3BtZW50IEtpdH0gICBcclxuICAgKiB0byBjcmVhdGUgdGhlIGZvbGxvd2luZyByZXNvdXJjZXM6XHJcbiAgICpcclxuICAgKiAtIEFuIEFtYXpvbiBTMyBidWNrZXRcclxuICAgKiBcclxuICAgKiAtIEFuIEFtYXpvbiBEeW5hbW9EQiB0YWJsZVxyXG4gICAqIFxyXG4gICAqIC0gQW4gQW1hem9uIFNOUyB0b3BpY1xyXG4gICAqIFxyXG4gICAqIC0gQW4gQW1hem9uIFNRUyBxdWV1ZVxyXG4gICAqXHJcbiAgICogSW4gYWRkaXRpb24sIHRoaXMgcHJvamVjdCBjcmVhdGVzIEFXUyBMYW1iZGEgZnVuY3Rpb25zLFxyXG4gICAqIGluIEdvLCB0byBkZXRlY3QgdGhlIGZvbGxvd2luZyBldmVudHM6XHJcbiAgICpcclxuICAgKiAtIEFuIG9iamVjdCB1cGxvYWRlZCB0byB0aGUgQW1hem9uIFMzIGJ1Y2tldFxyXG4gICAqIFxyXG4gICAqIC0gQW4gaXRlbSBhZGRlZCB0byB0aGUgQW1hem9uIER5bmFtb0RCIHRhYmxlXHJcbiAgICogXHJcbiAgICogLSBBIG1lc3NhZ2Ugc2VudCB0byB0aGUgQW1hem9uIFNOUyB0b3BpY1xyXG4gICAqIFxyXG4gICAqIC0gQSBtZXNzYWdlIHNlbnQgdG8gdGhlIEFtYXpvbiBTUVMgcXVldWVcclxuICAgKlxyXG4gICAqIFRoZSBnbyBmdW5jdGlvbnMgYXJlIGluIHRoZWlyIHJlc3BlY3RpdmUgc3ViLWZvbGRlcnMgaW4gYHNyY2AuXHJcbiAgICpcclxuICAgKiBAcmVtYXJrc1xyXG4gICAqIENvcHkgdGhlIGNvbnRlbnRzIG9mIHRoaXMgZGlyZWN0b3J5IHRvIHlvdXIgY29tcHV0ZXIuXHJcbiAgICogSWYgeW91IHdhbnQgdG8gY2hhbmdlIENsb3VkRm9ybWF0aW9uIHN0YWNrIG5hbWUgZnJvbSB0aGVcclxuICAgKiBjdXJyZW50IHZhbHVlIGBHb0xhbWJkYUNka1N0YWNrYCxcclxuICAgKiBjaGFuZ2UgdGhhdCB2YWx1ZSBpbiBgY2RrLmpzb25gLCBgYmluL2dvLWxhbWJkYS1jZGsudHNgLCBhbmQgYGxpYi9nby1sYW1iZGEtY2RrLXN0YWNrLnRzYFxyXG4gICAqIHRvIHRoZSB2YWx1ZSB5b3UgcHJlZmVyLlxyXG4gICAqIFxyXG4gICAqIFlvdSBtdXN0IHJ1biB0aGUgZm9sbG93aW5nIGNvbW1hbmQgdG8gZ2V0IHRoZSBwYWNrYWdlc1xyXG4gICAqIHRoYXQgdGhpcyBDREsgYXBwIHJlcXVpcmVzOlxyXG4gICAqIFxyXG4gICAqIGBucG0gaW5zdGFsbGBcclxuICAgKiBcclxuICAgKiBZb3UnbGwga25vdyB5b3UgaGF2ZSBhbGwgb2YgdGhlIHBhY2thZ2VzIHlvdSBuZWVkXHJcbiAgICogaWYgeW91IGNhbiBzdWNjZXNzZnVsbHkgZXhlY3V0ZSB0aGUgZm9sbG93aW5nIGNvbW1hbmRcclxuICAgKiB0byBjcmVhdGUgYSBDbG91ZEZvcm1hdGlvbiBzdGFjayBmcm9tIHRoaXMgQ0RLIGFwcDpcclxuICAgKiBcclxuICAgKiBgY2RrIHN5bnRoYFxyXG4gICAqIFxyXG4gICAqIFRoaXMgY3JlYXRlcyB0aGUgdGVtcGxhdGUgYEdvTGFtYmRhQ2RrU3RhY2sudGVtcGxhdGUuanNvbmBcclxuICAgKiAodW5sZXNzIHlvdSd2ZSBjaGFuZ2VkIHRoZSBzdGFjayBuYW1lKSBpbiBgY2RrLm91dGAuXHJcbiAgICogXHJcbiAgICogSWYgeW91IGVuY291bnRlciBhbnkgZXJyb3JzIHJ1bm5pbmcgQ0RLIGNvbW1hbmRzLFxyXG4gICAqIHNlZSB0aGVcclxuICAgKiB7QGxpbmsgaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL2Nkay9sYXRlc3QvZ3VpZGUvdHJvdWJsZXNob290aW5nLmh0bWwjdHJvdWJsZXNob290aW5nX3Rvb2xraXQgfCBUcm91Ymxlc2hvb3RpbmcgY29tbW9uIEFXUyBDREsgaXNzdWVzfVxyXG4gICAqIHRvcGljIGluIHRoZSBDREsgZGV2ZWxvcGVyIGd1aWRlLlxyXG4gICAqIFxyXG4gICAqIFdvcmtpbmcgd2l0aCB0aGUgQ0RLIGFwcFxyXG4gICAqIFxyXG4gICAqIElmIHlvdSBhcmVuJ3QgZmFtaWxpYXIgd2l0aCB0aGUgQ0RLLCBoZXJlIGFyZSBzb21lIGNvbW1vbiBjb21tYW5kczpcclxuICAgKiBcclxuICAgKiAtIGBjZGsgZGVwbG95YCBkZXBsb3kgdGhpcyBzdGFjayB0byB5b3VyIGRlZmF1bHQgQVdTIGFjY291bnQvcmVnaW9uXHJcbiAgICogLSBgY2RrIGRpZmZgICAgY29tcGFyZSBkZXBsb3llZCBzdGFjayB3aXRoIGN1cnJlbnQgc3RhdGVcclxuICAgKiAtIGBjZGsgbHNgICAgICBsaXN0cyB5b3VyIENsb3VkRm9ybWF0aW9uIHN0YWNrc1xyXG4gICAqIC0gYGNkayBzeW50aGAgIGNyZWF0ZSBhIENsb3VkRm9ybWF0aW9uIHRlbXBsYXRlIGluIFxyXG4gICAqIFxyXG4gICAqIFNlZSB7QGxpbmsgaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL2Nkay9sYXRlc3QvZ3VpZGUvY2xpLmh0bWwgfCBDREsgY29tbWFuZH1cclxuICAgKiB0b3BpYyBpbiB0aGUgQ0RLIGRldmVsb3BlciBndWlkZSBmb3IgZGV0YWlscy5cclxuICAgKiBcclxuICAgKiBHZXR0aW5nIGluZm9ybWF0aW9uIGFib3V0IHRoZSBuZXcgcmVzb3VyY2VzXHJcbiAgICogXHJcbiAgICogT25jZSB5b3UgZGVwbG95IHRoZSBhcHBsaWNhdGlvbiwgaXQgZGlzcGxheSB0aGUgZm9sbG93aW5nIGluZm9ybWF0aW9uXHJcbiAgICogdGhhdCB5b3UgY2FuIHVzZSB0byB3b3JrIHdpdGggdGhlIGNyZWF0ZWQgcmVzb3VyY2VzOlxyXG4gICAqIFxyXG4gICAqIC0gVGhlIG5hbWUgb2YgdGhlIHJlc291cmNlXHJcbiAgICogXHJcbiAgICogLSBUaGUgbmFtZSBvZiB0aGUgTGFtYmRhIGZ1bmN0aW9uIHRoYXQgaGFuZGxlcyB0aGUgZXZlbnRzIGZyb20gdGhlIHJlc291cmNlXHJcbiAgICogXHJcbiAgICogLSBUaGUgbmFtZSBvZiB0aGUgQW1hem9uIENsb3VkV2F0Y2ggbG9nIGdyb3VwIHRvIHdoaWNoIHByaW50IHN0YXRlbWVudHMgZnJvbSB0aGUgQVdTIExhbWJkYSBmdW5jdGlvbiBhcmUgc2VudFxyXG4gICAqICAgXHJcbiAgICogWW91IGNhbiB1c2UgdGhlIENMSSB0byBnZXQgaW5mb3JtYXRpb24gYWJvdXQgdGhlIHJlc291cmNlcyBjcmVhdGVkIGJ5XHJcbiAgICogdGhlIHJlc3VsdGluZyBDbG91ZEZvcm1hdGlvbiB0ZW1wbGF0ZSBieSBydW5uaW5nIHRoZSBmb2xsb3dpbmcgY29tbWFuZCxcclxuICAgKiB3aGVyZSBgU1RBQ0stTkFNRWAgaXMgdGhlIG5hbWUgb2YgeW91ciBDbG91ZEZvcm1hdGlvbiBzdGFjazpcclxuICAgKiBcclxuICAgKiBgYXdzIGNsb3VkZm9ybWF0aW9uIGRlc2NyaWJlLXN0YWNrcyAtLXN0YWNrLW5hbWUgU1RBQ0stTkFNRSAtLXF1ZXJ5IFN0YWNrc1swXS5PdXRwdXRzIC0tb3V0cHV0IHRleHRgXHJcbiAgICogXHJcbiAgICogVGVzdGluZyB0aGUgbm90aWZpY2F0aW9uc1xyXG4gICAqIFxyXG4gICAqIFRoaXMgcHJvamVjdCBjb250YWlucyB0aGUgZm9sbG93aW5nIFdpbmRvd3MgYmF0Y2ggYW5kIEJhc2ggc2NyaXB0IGZpbGVzIHRoYXQgeW91IGNhbiB1c2UgXHJcbiAgICogdG8gdGVzdCB0aGUgQVdTIExhbWJkYSBmdW5jdGlvbnMgYnkgc2VuZGluZyBhIEpTT04gcGF5bG9hZCB0byB0aGUgZnVuY3Rpb24gc3BlY2lmaWVkIG9uIHRoZSBjb21tYW5kIGxpbmU6XHJcbiAgICogXHJcbiAgICogLSBgRHluYW1vREJSZWNvcmQuYmF0YCwgYER5bmFtb0RCUmVjb3JkLnNoYDogdGhlc2Ugc2NyaXB0cyBzZW5kIHRoZSBkYXRhIGluIGBkeW5hbW9kYi1wYXlsb2FkLmpzb25gLlxyXG4gICAqIFxyXG4gICAqIC0gYFMzUmVjb3JkLmJhdGAsIGBTM1JlY29yZC5zaGA6IHRoZXNlIHNjcmlwdHMgc2VuZCB0aGUgZGF0YSBpbiBgczMtcGF5bG9hZC5qc29uYC5cclxuICAgKiBcclxuICAgKiAtIGBTTlNSZWNvcmQuYmF0YCwgYFNOU1JlY29yZC5zaGA6IHRoZXNlIHNjcmlwdHMgc2VuZCB0aGUgZGF0YSBpbiBgc25zLXBheWxvYWQuanNvbmAuXHJcbiAgICogXHJcbiAgICogLSBgU1FTUmVjb3JkLnNoYCwgYFNRU1JlY29yZC5iYXRgOiB0aGVzZSBzY3JpcHRzIHNlbmQgdGhlIGRhdGEgaW4gYHNxcy1wYXlsb2FkLmpzb25gLlxyXG4gICAqIFxyXG4gICAqIEBwdWJsaWNcclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkNvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgLy8gQ3JlYXRlIEFtYXpvbiBEeW5hbW9EQiB0YWJsZSB3aXRoIHByaW1hcnkga2V5IGlkIChzdHJpbmcpXHJcbiAgICBjb25zdCBteVRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdNeVRhYmxlJywge1xyXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcclxuICAgICAgc3RyZWFtOiBTdHJlYW1WaWV3VHlwZS5ORVdfSU1BR0UsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBDcmVhdGUgQW1hem9uIFNpbXBsZSBTdG9yYWdlIFNlcnZpY2UgKEFtYXpvbiBTMykgYnVja2V0IGFuZCBnaXZlIGl0IGEgdGFnXHJcbiAgICBjb25zdCBteUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgXCJNeUJ1Y2tldFwiLCk7XHJcbiAgICBjZGsuVGFncy5vZihteUJ1Y2tldCkuYWRkKCdOYW1lVGFnJywgJ015QnVja2V0Jyk7XHJcblxyXG4gICAgLy8gQ3JlYXRlIEFtYXpvbiBTaW1wbGUgTm90aWZpY2F0aW9uIFNlcnZpY2UgKEFtYXpvbiBTTlMpIHRvcGljXHJcbiAgICBjb25zdCBteVRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnTXlUb3BpYycsIHtcclxuICAgICAgZGlzcGxheU5hbWU6ICdVc2VyIHN1YnNjcmlwdGlvbiB0b3BpYydcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIENyZWF0ZSBBbWF6b24gU2ltcGxlIFF1ZXVlIFNlcnZpY2UgKEFtYXpvbiBTUVMpIHF1ZXVlXHJcbiAgICBjb25zdCBteVF1ZXVlID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCAnTXlOZXdRdWV1ZScpO1xyXG5cclxuICAgIC8vIFN1YnNjcmliZSBhIHF1ZXVlIHRvIHRoZSB0b3BpYzpcclxuICAgIGNvbnN0IG15U3Vic2NyaXB0aW9uID0gbmV3IHN1YnMuU3FzU3Vic2NyaXB0aW9uKG15UXVldWUpXHJcbiAgICBteVRvcGljLmFkZFN1YnNjcmlwdGlvbihteVN1YnNjcmlwdGlvbik7XHJcblxyXG4gICAgLyogQ3JlYXRlIEFXUyBMYW1iZGEgZnVuY3Rpb25zIGZvciBhbGwgc291cmNlczpcclxuICAgICAgIE5vdGUgdGhhdCBvbiBXaW5kb3dzIHlvdSdsbCBoYXZlIHRvIHJlcGxhY2UgdGhlIGZ1bmN0aW9ucyB3aXRoIGEgWklQIGZpbGUgeW91IGNyZWF0ZSBieTpcclxuICAgICAgIDEuIE5hdmlnYXRpbmcgdG8gY29kZSBsb2NhdGlvblxyXG4gICAgICAgMi4gUnVubmluZyBmcm9tIGEgV2luZG93cyBjb21tYW5kIHByb21wdCAod2hlcmUgbWFpbiBpcyB5b3VyIGhhbmRsZXIgbmFtZSk6XHJcbiAgICAgICAgICBhLiBzZXQgR09PUz1saW51eFxyXG4gICAgICAgICAgYi4gc2V0IEdPQVJDSD1hbWQ2NFxyXG4gICAgICAgICAgYy4gc2V0IENHT19FTkFCTEVEPTBcclxuICAgICAgICAgIGQuIGdvIGJ1aWxkIC1vIG1haW5cclxuICAgICAgICAgIGUuIGJ1aWxkLWxhbWJkYS16aXAuZXhlIC1vIG1haW4uemlwIG1haW5cclxuICAgICAgICAgIGYuIGF3cyBsYW1iZGEgdXBkYXRlLWZ1bmN0aW9uLWNvZGUgLS1mdW5jdGlvbi1uYW1lIEZVTkNUSU9OLU5BTUUgLS16aXAtZmlsZSBmaWxlYjovL21haW4uemlwXHJcbiBcclxuICAgICAgICAgIFlvdSBjYW4gZ2V0IGJ1aWxkLWxhbWJkYS16aXAuZXhlIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2F3cy9hd3MtbGFtYmRhLWdvL3RyZWUvbWFzdGVyL2NtZC9idWlsZC1sYW1iZGEtemlwLlxyXG4gICAgKi9cclxuXHJcbiAgICAvLyBEeW5hbW9kYiBMYW1iZGEgZnVuY3Rpb246XHJcbiAgICBjb25zdCBteUR5bmFtb0RiRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdNeUR5bmFtb0RCRnVuY3Rpb24nLCB7XHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLkdPXzFfWCxcclxuICAgICAgaGFuZGxlcjogJ21haW4nLFxyXG4gICAgICBjb2RlOiBuZXcgbGFtYmRhLkFzc2V0Q29kZSgnc3JjL2R5bmFtb2RiJyksIC8vIEdvIHNvdXJjZSBmaWxlIGlzIChyZWxhdGl2ZSB0byBjZGsuanNvbik6IHNyYy9keW5hbW9kYi9tYWluLmdvXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTZXQgdXAgZGVhZC1sZXR0ZXIgcXVldWUgZm9yIGZhaWxlZCBEeW5hbW9EQiBvciBBbWF6b24gU05TIGV2ZW50c1xyXG4gICAgY29uc3QgZGxRdWV1ZSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ015RExRdWV1ZScpO1xyXG5cclxuICAgIC8vIFNlZVxyXG4gICAgLy8gICBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vY2RrL2FwaS9sYXRlc3QvZG9jcy9hd3MtbGFtYmRhLWV2ZW50LXNvdXJjZXMtcmVhZG1lLmh0bWxcclxuICAgIC8vIGZvciBpbmZvcm1hdGlvbiBvbiBMYW1iZGEgZXZlbnQgc291cmNlcy5cclxuXHJcbiAgICAvLyBDb25maWd1cmUgTGFtYmRhIGZ1bmN0aW9uIHRvIGhhbmRsZSBldmVudHMgZnJvbSBEeW5hbW9EQiB0YWJsZS5cclxuICAgIG15RHluYW1vRGJGdW5jdGlvbi5hZGRFdmVudFNvdXJjZShuZXcgRHluYW1vRXZlbnRTb3VyY2UobXlUYWJsZSwge1xyXG4gICAgICBzdGFydGluZ1Bvc2l0aW9uOiBsYW1iZGEuU3RhcnRpbmdQb3NpdGlvbi5UUklNX0hPUklaT04sXHJcbiAgICAgIGJhdGNoU2l6ZTogNSxcclxuICAgICAgYmlzZWN0QmF0Y2hPbkVycm9yOiB0cnVlLFxyXG4gICAgICBvbkZhaWx1cmU6IG5ldyBTcXNEbHEoZGxRdWV1ZSksXHJcbiAgICAgIHJldHJ5QXR0ZW1wdHM6IDEwXHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gQW1hem9uIFMzIExhbWJkYSBmdW5jdGlvblxyXG4gICAgY29uc3QgbXlTM0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTXlTM0Z1bmN0aW9uJywge1xyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5HT18xX1gsXHJcbiAgICAgIGhhbmRsZXI6ICdtYWluJyxcclxuICAgICAgY29kZTogbmV3IGxhbWJkYS5Bc3NldENvZGUoJ3NyYy9zMycpLCAvLyBHbyBzb3VyY2UgZmlsZSBpcyAocmVsYXRpdmUgdG8gY2RrLmpzb24pOiBzcmMvczMvbWFpbi5nb1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ29uZmlndXJlIEFtYXpvbiBTMyBidWNrZXQgdG8gc2VuZCBub3RpZmljYXRpb24gZXZlbnRzIHRvIExhbWJkYSBmdW5jdGlvbi5cclxuICAgIG15QnVja2V0LmFkZEV2ZW50Tm90aWZpY2F0aW9uKEV2ZW50VHlwZS5PQkpFQ1RfQ1JFQVRFRCwgbmV3IG5vdHMuTGFtYmRhRGVzdGluYXRpb24obXlTM0Z1bmN0aW9uKSlcclxuXHJcbiAgICAvKiBUZXN0IHRoZSBmdW5jdGlvbiBmcm9tIHRoZSBjb21tYW5kIGxpbmUgYnkgc2VuZGluZyBhIG5vdGlmaWNhdGlvbiAodGhpcyBkb2VzIG5vdCB1cGxvYWQgS0VZLU5BTUUgdG8gQlVDS0VULU5BTUUpIHdpdGg6XHJcbiAgICAgICAgICBhd3MgbGFtYmRhIGludm9rZSAtLWZ1bmN0aW9uLW5hbWUgRlVOQ1RJT04tTkFNRSBvdXQgXFxcclxuICAgICAgICAgIC0tcGF5bG9hZCAneyBcIlJlY29yZHNcIjpbIHsgXCJldmVudFNvdXJjZVwiOlwiYXdzOnMzXCIsIFwiZXZlbnRUaW1lXCI6XCIxOTcwLTAxLTAxVDAwOjAwOjAwLjAwMFpcIiwgXFxcclxuICAgICAgICAgIFwiczNcIjp7IFwiYnVja2V0XCI6eyBcIm5hbWVcIjpcIkJVQ0tFVC1OQU1FXCIgfSB9LCBcXFxyXG4gICAgICAgICAgXCJvYmplY3RcIjp7IFwia2V5XCI6XCJLRVktTkFNRVwiIH0gfSBdIH0nIC0tbG9nLXR5cGUgVGFpbCAtLXF1ZXJ5ICdMb2dSZXN1bHQnIC0tb3V0cHV0IHRleHQgfCBiYXNlNjQgLWRcclxuICAgICAgIHdoZXJlOlxyXG4gICAgICAgICBGVU5DVElPTi1OQU1FIGlzIHRoZSBuYW1lIG9mIHlvdXIgTGFtYmRhIGZ1bmN0aW9uXHJcbiAgICAgICAgIEJVQ0tFVC1OQU1FIGlzIHRoZSBuYW1lIG9mIHRoZSBTMyBidWNrZXQgc2VuZGluZyBub3RpZmljYXRpb25zIHRvIExhbWJkYVxyXG4gICAgICAgICBLRVktTkFNRSBpcyB0aGUgbmFtZSBvZiB0aGUgb2JqZWN0IHVwbG9hZGVkIHRvIHRoZSBidWNrZXRcclxuICAgICovXHJcblxyXG4gICAgLy8gQW1hem9uIFNOUyBMYW1iZGEgZnVuY3Rpb246XHJcbiAgICBjb25zdCBteVNOU0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTXlTTlNGdW5jdGlvbicsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuR09fMV9YLFxyXG4gICAgICBoYW5kbGVyOiAnbWFpbicsXHJcbiAgICAgIGNvZGU6IG5ldyBsYW1iZGEuQXNzZXRDb2RlKCdzcmMvc25zJyksIC8vIEdvIHNvdXJjZSBmaWxlIGlzIChyZWxhdGl2ZSB0byBjZGsuanNvbik6IHNyYy9zbnMvbWFpbi5nb1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ29uZmlndXJlIExhbWJkYSBmdW5jdGlvbiB0byBoYW5kbGUgZXZlbnRzIGZyb20gQW1hem9uIFNOUyB0b3BpYy5cclxuICAgIG15U05TRnVuY3Rpb24uYWRkRXZlbnRTb3VyY2UobmV3IFNuc0V2ZW50U291cmNlKG15VG9waWMsIHtcclxuICAgICAgZmlsdGVyUG9saWN5OiB7XHJcbiAgICAgICAgRmllbGQ6IHNucy5TdWJzY3JpcHRpb25GaWx0ZXIuc3RyaW5nRmlsdGVyKHsgIC8vIFNlZSBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vY2RrL2FwaS9sYXRlc3QvZG9jcy9AYXdzLWNka19hd3Mtc25zLlN1YnNjcmlwdGlvbkZpbHRlci5odG1sXHJcbiAgICAgICAgICB3aGl0ZWxpc3Q6IFsnY2F0JywgJ2RvZyddLCAgLy8gT25seSBpbmNsdWRlIGV2ZW50cyB0aGF0IG1hdGNoIFxyXG4gICAgICAgIH0pLFxyXG4gICAgICB9LFxyXG4gICAgICBkZWFkTGV0dGVyUXVldWU6IGRsUXVldWUsXHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gQW1hem9uIFNRUyBMYW1iZGEgZnVuY3Rpb246XHJcbiAgICBjb25zdCBteVNRU0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTXlTUVNGdW5jdGlvbicsIHtcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuR09fMV9YLFxyXG4gICAgICBoYW5kbGVyOiAnbWFpbicsXHJcbiAgICAgIGNvZGU6IG5ldyBsYW1iZGEuQXNzZXRDb2RlKCdzcmMvc3FzJyksIC8vIEdvIHNvdXJjZSBmaWxlIGlzIChyZWxhdGl2ZSB0byBjZGsuanNvbik6IHNyYy9zcXMvbWFpbi5nb1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ29uZmlndXJlIExhbWJkYSBmdW5jdGlvbiB0byBoYW5kbGUgZXZlbnRzIGZyb20gU1FTIHF1ZXVlLlxyXG4gICAgbXlTUVNGdW5jdGlvbi5hZGRFdmVudFNvdXJjZShuZXcgU3FzRXZlbnRTb3VyY2UobXlRdWV1ZSwge1xyXG4gICAgICBiYXRjaFNpemU6IDEwLCAvLyBkZWZhdWx0XHJcbiAgICB9KSk7XHJcblxyXG4gICAgLy8gRGlzcGxheSBpbmZvIGFib3V0IHRoZSByZXNvdXJjZXMuXHJcbiAgICAvLyBZb3UgY2FuIHNlZSB0aGlzIGluZm9ybWF0aW9uIGF0IGFueSB0aW1lIGJ5IHJ1bm5pbmc6XHJcbiAgICAvLyAgIGF3cyBjbG91ZGZvcm1hdGlvbiBkZXNjcmliZS1zdGFja3MgLS1zdGFjay1uYW1lIEdvQ2RrU3RhY2sgLS1xdWVyeSBTdGFja3NbMF0uT3V0cHV0cyAtLW91dHB1dCB0ZXh0XHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdCdWNrZXQgbmFtZTogJywgeyB2YWx1ZTogbXlCdWNrZXQuYnVja2V0TmFtZSB9KTtcclxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ1MzIGZ1bmN0aW9uIG5hbWU6ICcsIHsgdmFsdWU6IG15UzNGdW5jdGlvbi5mdW5jdGlvbk5hbWUgfSk7XHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdTMyBmdW5jdGlvbiBDbG91ZFdhdGNoIGxvZyBncm91cDogJywgeyB2YWx1ZTogbXlTM0Z1bmN0aW9uLmxvZ0dyb3VwLmxvZ0dyb3VwTmFtZSB9KTtcclxuXHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdUYWJsZSBuYW1lOiAnLCB7IHZhbHVlOiBteVRhYmxlLnRhYmxlTmFtZSB9KTtcclxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ0R5bmFtb0RCIGZ1bmN0aW9uIG5hbWU6ICcsIHsgdmFsdWU6IG15RHluYW1vRGJGdW5jdGlvbi5mdW5jdGlvbk5hbWUgfSk7XHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdEeW5hbW9EQiBmdW5jdGlvbiBDbG91ZFdhdGNoIGxvZyBncm91cDogJywgeyB2YWx1ZTogbXlEeW5hbW9EYkZ1bmN0aW9uLmxvZ0dyb3VwLmxvZ0dyb3VwTmFtZSB9KTtcclxuXHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdUb3BpYyBuYW1lOiAnLCB7IHZhbHVlOiBteVRvcGljLnRvcGljTmFtZSB9KTtcclxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ1NOUyBmdW5jdGlvbiBuYW1lOiAnLCB7IHZhbHVlOiBteVNOU0Z1bmN0aW9uLmZ1bmN0aW9uTmFtZSB9KTtcclxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ1NOUyBmdW5jdGlvbiBDbG91ZFdhdGNoIGxvZyBncm91cDogJywgeyB2YWx1ZTogbXlTTlNGdW5jdGlvbi5sb2dHcm91cC5sb2dHcm91cE5hbWUgfSk7XHJcblxyXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnUXVldWUgbmFtZTogJywgeyB2YWx1ZTogbXlRdWV1ZS5xdWV1ZU5hbWUgfSk7XHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdTUVMgZnVuY3Rpb24gbmFtZTogJywgeyB2YWx1ZTogbXlTUVNGdW5jdGlvbi5mdW5jdGlvbk5hbWUgfSk7XHJcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdTUVMgZnVuY3Rpb24gQ2xvdWRXYXRjaCBsb2cgZ3JvdXA6ICcsIHsgdmFsdWU6IG15U1FTRnVuY3Rpb24ubG9nR3JvdXAubG9nR3JvdXBOYW1lIH0pO1xyXG4gIH1cclxufVxyXG5cclxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcclxubmV3IEdvQ2RrU3RhY2soYXBwLCAnR29DZGtTdGFjaycpO1xyXG4iXX0=