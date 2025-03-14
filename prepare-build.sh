#!/bin/sh
npx prisma migrate dev --name migration
npm run start:prod