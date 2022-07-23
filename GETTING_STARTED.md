# Getting started

The project has many moving parts, and thus has a large amount of setup involved.

In order to run the project, you will need:

- A [Google Forms](https://forms.google.com) form
- A backend server
- A [Discord Bot](https://discord.com/developers/applications)
- The ability to write App Scripts to the Form

## Setting up the services

Before we can deploy the app, we must set up all of the services, as noted above.

#### Google Form

To set up the Google Form, head to [this page](https://forms.google.com) and select the "Contact Information" template.

Add all of the required fields, in order:

- Project creator / author
- Project name
- Project description
- Project source (with optional regex validation)
- Project languages / technologies
- Other links

Next, add the Apps Script integration

TODO: add details about how to add the Apps Script integration

#### Discord Bot

First, create a Discord Application [here](https://discord.com/developers/applications).

Next, enable the Bot section of the application and copy the token into the backend config.

After that, invite it to your server by going to the OAuth2 section, and then the URL Generator subsection. Select the `bot` and `applications.commands` scopes and give the bot the following permissions:

TODO: add global bot permissions

Finally, click the generated link and invite the bot to your server.

TODO: add details about what permissions the bot needs in the channels

#### Backend

The backend server operates to collect incoming submissions, handle voting and persist submission state.

The choice of backend hosting is up to the end user, though you must provide a [Prisma](https://www.prisma.io/) compatible DB (our implementation uses PostgreSQL), and the ability to run Node.js with an HTTP webserver.

After getting a backend host, configure it following the `.env.example` file and start the webserver.
