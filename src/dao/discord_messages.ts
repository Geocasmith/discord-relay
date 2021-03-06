import * as AWS from 'aws-sdk';
import * as Discord from 'discord.js';
import * as _ from 'lodash';
import * as uuid from 'uuid';

import createLogger from '../lib/logger';
import BaseDAO, { ISchema } from './base';
import { IToken } from './discord_bots';

const LOG = createLogger('DiscordMessageDAO');

export interface IMessage extends ISchema {
  authorId: string;
  authorUsername: string;
  channelId?: string;
  messageId: string;
  timestamp: number;
  tokenId: string;
  messageType?: string;
  eventName?: string;
}

export enum MessageType {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
  EVENT = 'EVENT',
}

export class DiscordMessageDAO extends BaseDAO<IMessage> {
  constructor(dynamoDB: AWS.DynamoDB) {
    super('DiscordRelay.Messages', dynamoDB, 'tokenId', 'S', 'messageId', 'S');
  }

  public async persistMessage(
    token: IToken,
    authorId: string,
    authorUsername: string,
    timestamp: number,
    type: MessageType,
    channelId?: string,
    eventName?: string,
  ): Promise<string> {
    const messageId = uuid.v4();

    const data: { Item: { [key: string]: AWS.DynamoDB.AttributeValue }, TableName: string } = {
      Item: {
        authorId: {
          S: authorId,
        },
        authorUsername: {
          S: authorUsername,
        },
        messageId: {
          S: messageId,
        },
        messageType: {
          S: type,
        },
        timestamp: {
          N: timestamp.toString(),
        },
        tokenId: {
          S: token.tokenId,
        },
      },
      TableName: this.tableName,
    };

    if (eventName) {
      data.Item.eventName = {
        S: eventName,
      };
    }
    if (channelId) {
      data.Item.channelId = {
        S: channelId,
      };
    }

    await this.dynamoDB.putItem(data, undefined).promise();

    return messageId;
  }

  public async getMessagesForToken(tokenId: string): Promise<IMessage[] > {
    const results = await this.dynamoDB.query({
      ExpressionAttributeValues: {
        ':tokid': {
          S: tokenId,
        },
      },
      KeyConditionExpression: 'tokenId = :tokid',
      TableName: this.tableName,
    }, undefined).promise();

    return _.map(results.Items, this.mapItemToMessage);
  }

  private mapItemToMessage(
    item: { [key: string]: AWS.DynamoDB.AttributeValue },
  ): IMessage {
    return {
      authorId: item.authorId.S as string,
      authorUsername: item.authorUsername.S as string,
      channelId: _.get(item, 'channelId.S') as string,
      eventName: _.get(item, 'eventName.S') as string,
      messageId: item.messageId.S as string,
      messageType: _.get(item, 'messageType.S') as string,
      timestamp: parseInt(item.timestamp.N as string, 10),
      tokenId: item.tokenId.S as string,
    };
  }
}
