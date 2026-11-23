import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { marketRouter } from './market.route.js';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use('/market', marketRouter);
