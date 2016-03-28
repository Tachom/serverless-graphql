import Promise from 'bluebird';
import AWS from 'aws-sdk';
import uuid from 'uuid';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const dynamoConfig = {
  sessionToken:    process.env.AWS_SESSION_TOKEN,
  region:          process.env.AWS_REGION
};


const docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
const stage = process.env.SERVERLESS_STAGE;
const projectName = process.env.SERVERLESS_PROJECT;
const usersTable = projectName + '-users-' + stage;

export function createUser(user) {
  return new Promise(function(resolve, reject) {

    user.id = uuid.v1();

    // save password hash
    user.password_hash = crypto
      .createHmac('md5', process.env.AUTH_TOKEN_SECRET)
      .update(user.password)
      .digest('hex');

    delete user.password; // don't save plain password!

    var params = {
      TableName: usersTable,
      Item: user
    };

    docClient.put(params, function(err, data) {
      if (err) return reject(err);
      return resolve(user);
    });

  });
}

export function loginUser(user) {
  return new Promise(function(resolve, reject) {

    var params = {
      TableName: usersTable,
      Key: {
        username: user.username
      },
      AttributesToGet: [
        'id',
        'name',
        'username',
        'email',
        'password_hash'
      ]
    };

    docClient.get(params, function(err, data) {
      if (err) return reject(err);

      var password_hash = crypto
        .createHmac('md5', process.env.AUTH_TOKEN_SECRET)
        .update(user.password)
        .digest('hex');

      if (password_hash != data.Item.password_hash) reject('invalid password');

      delete data.Item.password_hash;

      data.Item.jwt = jwt.sign(data.Item, process.env.AUTH_TOKEN_SECRET);

      return resolve(data.Item);
    });
  });
}

export function updateUser(obj) {
  return new Promise(function(resolve, reject) {

    // make sure user is logged in
    var user = jwt.verify(obj.jwt, process.env.AUTH_TOKEN_SECRET);

    // update data
    user.email = obj.email || user.email;
    user.name = obj.name || user.name;
    user.password_hash = crypto
      .createHmac('md5', process.env.AUTH_TOKEN_SECRET)
      .update(obj.password)
      .digest('hex');

    var params = {
      TableName: usersTable,
      Item: user
    };

    docClient.put(params, function(err, data) {
      if (err) return reject(err);
      return resolve(user);
    });

  });
}

export function getUsers() {
  return new Promise(function(resolve, reject) {
    var params = {
      TableName: usersTable,
      AttributesToGet: [
        'id',
        'username',
        'name',
        'email'
      ]
    };

    docClient.scan(params, function(err, data) {
      if (err) return reject(err);
      return resolve(data.Items);
    });
  });
}

export function getUser(username) {
  return new Promise(function(resolve, reject) {
    var params = {
      TableName: usersTable,
      Key: {
        username: username
      },
      AttributesToGet: [
        'id',
        'username',
        'name',
        'email'
      ]
    };

    docClient.get(params, function(err, data) {
      if (err) return reject(err);
      return resolve(data.Item);
    });

  });
}

export function deleteUser(obj) {
  return new Promise(function(resolve, reject) {

    var user = jwt.verify(obj.jwt, process.env.AUTH_TOKEN_SECRET);

    var params = {
      TableName: usersTable,
      Key: {
        username: user.username
      }
    };

    docClient.delete(params, function(err, data) {
      if (err) return reject(err);
      return resolve();
    });

  });
}