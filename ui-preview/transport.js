// Browser-only transport. Production Vite never includes these aliases.
// ORIGINAL API validators and handlers run against isolated sample data.
import { currentPreviewUser } from './auth';
export function createServerFn() {
  let schema; let protectedRoute = false;
  const builder = {
    validator(value) { schema = value; return builder; },
    middleware() { protectedRoute = true; return builder; },
    handler(handler) {
      return async (input = {}) => {
        const user = currentPreviewUser();
        if (protectedRoute && !user) throw new Error('请先选择示例发起人身份');
        const data = schema ? schema.parse(input.data) : input.data;
        return handler({ data, context: { userId: user?.id } });
      };
    },
  };
  return builder;
}
const cookies = new Map();
export const getCookie = name => cookies.get(name);
export const setCookie = (name, value) => cookies.set(name, value);
export const authMiddleware = {};
