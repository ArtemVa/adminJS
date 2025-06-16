import { DefaultAuthProvider } from 'adminjs';
import componentLoader from './component-loader.js';
import { login } from "../services/authService.js";
const provider = new DefaultAuthProvider({
  componentLoader,
  authenticate: async ({ email, password }) => {
    const user = await login(email, password);
    if (!user) return null;

    return {
      email: user.phone,
      company: user.company,
      name: user.name
    };
  }
});
export default provider;
