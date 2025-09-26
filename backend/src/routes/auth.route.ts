import { Router } from 'express';
import { 
  register, 
  login, 
  refreshToken, 
  logout, 
  getProfile, 
  changePassword 
} from '../controllers/auth.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const authRouter = Router();



authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/refresh-token', refreshToken);



authRouter.post('/logout', authenticateToken, logout);
authRouter.get('/profile', authenticateToken, getProfile);
authRouter.put('/change-password', authenticateToken ,changePassword);


export default authRouter;