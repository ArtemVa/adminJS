import { AdminJSOptions } from 'adminjs';

import componentLoader from './component-loader.js';

const options: AdminJSOptions = {
  componentLoader,
  rootPath: '/admin',
  resources: ['user'],
  databases: [],
};

export default options;
