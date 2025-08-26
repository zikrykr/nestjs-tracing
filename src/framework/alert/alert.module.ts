import { Module } from '@nestjs/common';
import { TeamsAlertService } from './teams-alert.service';
import { SlackAlertService } from './slack-alert.service';
import { GoogleChatAlertService } from './google-chat-alert.service';
import { UnifiedAlertService } from './unified-alert.service';

@Module({
  providers: [
    TeamsAlertService,
    SlackAlertService,
    GoogleChatAlertService,
    UnifiedAlertService,
  ],
  exports: [
    TeamsAlertService,
    SlackAlertService,
    GoogleChatAlertService,
    UnifiedAlertService,
  ],
})
export class AlertModule {} 