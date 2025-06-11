import componentLoader from './component-loader.js';
import User from '../db/user.model.js';
import Chat from "../db/chat.model.js";
import Newsletter from "../db/newsletter.model.js";
import Project from "../db/project.model.js"
import ProjectFile from "../db/projectFile.model.js";
import Channel from "../db/channel.model.js";
import Client from "../db/client.model.js";
import Company from "../db/company.model.js";
import Promocode from "../db/promocode.model.js";
import Message from "../db/message.model.js";
import Group from "../db/group.model.js";
import CRMPipeline from "../db/crmPipeline.model.js";
import File_Storage from "../db/fileStorage.js";


const options = {
    componentLoader,
    rootPath: '/admin',
    resources: [User, Chat, Newsletter, Project, ProjectFile, Channel, Client, Company, Promocode, Message, Group, CRMPipeline, File_Storage],
    databases: [],
};
export default options;
