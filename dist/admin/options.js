import componentLoader from './component-loader.js';
import User from '../db/user.model.js';

const options = {
    componentLoader,
    rootPath: '/admin',
    resources: [User],
    databases: [],
};
export default options;
