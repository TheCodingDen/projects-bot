import { GuildMember } from "discord.js";

export interface Draft {
  id: string;
  timestamp: Date;
  content: string;
  author: GuildMember;
}
