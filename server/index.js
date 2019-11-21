import { checkNpmVersions } from 'meteor/tmeasday:check-npm-versions';
import { load } from 'graphql-load';
import { db } from 'meteor/cultofcoders:grapher';
// import getRenderer from './ssr';

import './scalars';
import './types';

export { default as Config } from './config';
export { getUserForContext } from './core/users';
export { default as initialize } from './initialize';
export { default as expose } from './morpher/expose';

export { load, db, getRenderer };

checkNpmVersions({
  'apollo-server-express': '2.x.x',
  graphql: '14.x.x',
  'graphql-load': '0.1.x',
  'graphql-type-json': '0.x.x',
  'graphql-tools': '4.x.x',
});
