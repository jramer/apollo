# React-Native Client

Things mostly should just work out of the box for a react-native client. Make sure you install the following packages:

- apollo-cache-redux
- apollo-client
- apollo-link
- apollo-link-context
- apollo-link-error
- apollo-link-http
- apollo-link-ws
- apollo-live-client
- apollo-utilities
- core-js
- meteor-apollo-accounts
- react-apollo
- subscriptions-transport-ws

If you don't use redux, install apollo-cache-inmemory instead of apollo-cache-redux, or any other cache implementation.

There are, however, a few things to keep in mind:

- Authentication token is usually stored in AsyncStorage, and retrieval of the token is an asynchronous process.
- The authorization header needs to set up appropriately for both http links and websocket links.
- logout function from meteor-apollo-accounts uses ```Symbol``` which is not supported on Android.

Since retrieval of the token is an asynchronous process, care must be taken to set it up appropriately for your http and websocket links. Let us first create a function to retrieve the token from AsyncStorage as a promise:

```js
// our login token cache
let loginToken;

// gets token from cache or from AsyncStorage
function getLoginToken() {
  return new Promise((resolve, reject) => {
    // eslint-disable-line no-undef
    if (loginToken) {
      console.log('resolving login token ' + loginToken);
      resolve(loginToken);
    } else {
      AsyncStorage.getItem(constants.AUTH_TOKEN_LOCALSTORAGE)
        .then(token => {
          console.log('retrieved login token from AsyncStorage: ' + token);
          loginToken = token;
          resolve(token);
        })
        .catch(() => {
          console.log('no login token found!');
          reject('');
        });
    }
  });
}
```

Notice that we use a cache to avoid unnecessary lookups into AsyncStorage. We now need to provide this authorization token both your http and websocket links.

## HTTP Link

We will use `setContext()` from [apollo-link-context](https://github.com/apollographql/apollo-link/tree/master/packages/apollo-link-context) to set the authorization header:

```js
// our http link
const httpLink = createHttpLink({
  uri: constants.GRAPHQL_ENDPOINT,
});

const AUTH_TOKEN_KEY = 'meteor-login-token';

// create a link to insert the authorization header for http(s)
const authorizationLink = setContext(operation =>
  getLoginToken().then(token => {
    // eslint-disable-line no-unused-vars
    return {
      // set meteor token here
      headers: {
        [AUTH_TOKEN_KEY]: token || null,
      },
    };
  })
);

// create our query/mutation link which uses http(s)
const queryLink = ApolloLink.from([authorizationLink, httpLink]);
```

Now, every time the http link is used, it will query the latest login token. This will happen even if the login token changes.

## WebSocket Link

Things are slightly more complicated for websocket links which are required for subscriptions. You need to set up the WebSocketLink to use an asynchronous function to set up the authorization header since that is retrieved from AsyncStorage. 

```js
// our websocket link for subscriptions
const wsLink = new WebSocketLink({
  uri: constants.GRAPHQL_SUBSCRIPTION_ENDPOINT,
  options: {
    reconnect: true,
    connectionParams: () =>
      // a promise that resolves to return the loginToken
      new Promise((resolve, reject) => {
        // eslint-disable-line no-undef,no-unused-vars
        getLoginToken().then(token => {
          if (token) {
            console.log('wsLink loginToken = ' + token);
            resolve({
              [constants.AUTH_TOKEN_KEY]: token,
            });
          } else {
            resolve({
              [constants.AUTH_TOKEN_KEY]: '',
            });
          }
        });
      }),
  },
});
```

Now, the login token is resolved and sent to the server when the websocket connection is established.

Also, The token is sent only once when the connection is established, so if/when the token changes, the connection needs to be reestablished. To handle this, we essentially need to bounce the websocket link:

```js
wsLink.subscriptionClient.close(false, false);
```

This needs to be done at an appropriate place, such when your client receives a new login token. If you are using [meteor-apollo-accounts](https://github.com/cult-of-coders/meteor-apollo-accounts), then the loginToken change will happen in the `setTokenStore()` implementation:

```js
import {
  loginWithPassword,
  onTokenChange,
  setTokenStore,
} from 'meteor-apollo-accounts';
import { getMainDefinition } from 'apollo-utilities';

const AUTH_TOKEN_KEY = 'meteor-login-token';
const AUTH_TOKEN_LOCALSTORAGE = 'Meteor.loginToken';
const AUTH_TOKEN_EXPIRY = 'Meteor.loginTokenExpires';
const AUTH_USER_ID = 'Meteor.userId';

const link = split(
  ({ query }) => {
    const { kind, operation } = getMainDefinition(query);
    return kind === 'OperationDefinition' && operation === 'subscription';
  },
  wsLink,
  queryLink
);

// our apollo client
const client = new ApolloClient({
  link,
  cache,
});

// override setTokenStore to store login token in AsyncStorage
setTokenStore({
  set: async function({ userId, token, tokenExpires }) {
    console.log('setting new token ' + token);
    loginToken = token; // update cache
    await AsyncStorage.setItem(AUTH_USER_ID, userId);
    await AsyncStorage.setItem(AUTH_TOKEN_LOCALSTORAGE, token);
    // AsyncStorage doesn't support Date type so we'll store it as a String
    await AsyncStorage.setItem(AUTH_TOKEN_EXPIRY, tokenExpires.toString());
    if (token) {
      // we have a valid login token, reset apollo client store
      client.resetStore();
      // bounce the websocket link so that new token gets sent
      linkBounce = true;
      console.log('bouncing websocket link');
      wsLink.subscriptionClient.close(false, false);
    }
  },
  get: async function() {
    return {
      userId: await AsyncStorage.getItem(AUTH_USER_ID),
      token: await AsyncStorage.getItem(AUTH_TOKEN_LOCALSTORAGE),
      tokenExpires: await AsyncStorage.getItem(AUTH_TOKEN_EXPIRY),
    };
  },
});

// callback when token changes
onTokenChange(function() {
  console.log('token did change');
  client.resetStore(); // client is the apollo client instance
});
```

One thing to note is that, don't start a new subscription immediately after bouncing the link. Wait for the connection to be established before doing so. You can do that in the onConnected()/onReconnected() handlers:

```js
function _connected() {
  console.log('WE ARE CONNECTED!');
  // do someting here...
}

wsLink.subscriptionClient.onConnected(_connected);
wsLink.subscriptionClient.onReconnected(_connected);
```

## logout()


The ```logout()``` function from meteor-apollo-accounts uses ```Symbol``` which is not supported on Android. One option is to use a polyfill from core-js at the top of your main file:

On react-native, there are some other quirky issues. The meteor-apollo-accounts makes use of the Symbol type which is not supported on Android. A polyfill is required to handle this:


```js
// import this since android needs this to resolve
// https://github.com/orionsoft/meteor-apollo-accounts/issues/73
// solution was suggested here...
// https://github.com/facebook/react-native/issues/4676#issuecomment-163399041
import 'core-js/es6/symbol';
import 'core-js/fn/symbol/iterator';
import 'core-js/es6/set';
```

However, this breaks on react-native 0.56.0 and triggers https://github.com/facebook/react-native/issues/18542

The safest option seems to be to use a direct mutation:

```js
let token = loginToken;
let mutation = gql`
mutation logout($token: String!) {
    logout(token: $token) {
      success
    }
  }`;

client.mutate({
  mutation: mutation,
  variables: {
    token
  }
}).then((result) => {
  console.log("logout success: " + JSON.stringify(result));
  storeLoginData({
    userId: "",
    token: "",
    tokenExpires: ""
  });
}).catch((error) => {
  console.log("logout error: " + JSON.stringify(error));
  storeLoginData({
    userId: "",
    token: "",
    tokenExpires: ""
  });
});
```


This should get you functional on react-native!

---

### [Table of Contents](index.md)
