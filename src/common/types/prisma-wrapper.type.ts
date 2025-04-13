import { client } from '../prisma';

export type PrismaWrapper<T> = T & ReturnType<typeof client>;
