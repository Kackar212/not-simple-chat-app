# ###################
# # BUILD FOR LOCAL DEVELOPMENT
# ###################

# FROM node:20-alpine As development

# # Create app directory
# WORKDIR /usr/src/app

# # Copy application dependency manifests to the container image.
# # A wildcard is used to ensure copying both package.json AND package-lock.json (when available).
# # Copying this first prevents re-running npm install on every code change.
# COPY --chown=node:node package*.json ./

# # Install app dependencies using the `npm ci` command instead of `npm install`
# RUN npm install

# # Bundle app source
# COPY --chown=node:node . .

# # Use the node user from the image (instead of the root user)
# USER node

# ###################
# # BUILD FOR PRODUCTION
# ###################

# FROM node:20-alpine As build

# WORKDIR /usr/src/app

# COPY --chown=node:node package*.json ./

# # In order to run `npm run build` we need access to the Nest CLI which is a dev dependency. In the previous development stage we ran `npm ci` which installed all dependencies, so we can copy over the node_modules directory from the development image
# COPY --chown=node:node --from=development /usr/src/app/node_modules ./node_modules

# COPY --chown=node:node . .

# # Run the build command which creates the production bundle
# RUN npx prisma generate

# RUN npx prisma migrate deploy

# RUN npx prisma db seed

# RUN npm run build

# # Set NODE_ENV environment variable
# ENV \
# NODE_ENV production \
# PORT=8080 \
# HOST=0.0.0.0

# EXPOSE 8080
# # Running `npm ci` removes the existing node_modules directory and passing in --only=production ensures that only the production dependencies are installed. This ensures that the node_modules directory is as optimized as possible
# # RUN npm install --only=production && npm cache clean --force

# USER node

# ###################
# # PRODUCTION
# ###################

# FROM node:20-alpine As production

# # Copy the bundled code from the build stage to the production image
# WORKDIR ./

# COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
# COPY --chown=node:node --from=build /usr/src/app/dist ./dist
# COPY --chown=node:node --from=build /usr/src/app/public ./dist/public

# # Start the server using the production build
# CMD [ "node", "dist/src/main.js" ]

FROM node:20-alpine
 
WORKDIR /app
 
COPY . .
 
RUN npm ci --omit=dev

ENV \
APP_URL="http://192.168.100.4:4000" \
CLIENT_URL="http://192.168.100.4:3000" \
STATIC_FILES_DIRECTORY="public" \
DATABASE_URL="postgresql://postgres:Abcd123%21%40%23@localhost:5432/chat?connect_timeout=300" \
SESSION_SECRET="sUF4:L7yMM>5S.tqBE#3scW2wnG7amKT%qLX3unY0f~3s" \
GLOBAL_SERVER_NAME="ivU,4icAL!xuDF_3g 3j&Dz:8Np<9g>Ji" \
SYSTEM_ACCOUNT_NAME="System Account                " \
NODE_ENV="development"

# RUN npx prisma generate

# RUN npx prisma migrate dev

# RUN npx prisma db seed
 
# RUN npm run build
 
# USER node
 
CMD source prepare-build.sh