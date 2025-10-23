import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { RequestContext } from '../../request-context/request-context.dto';

@Injectable()
export class GoogleCalendarAuthService {
  private readonly logger = new Logger(GoogleCalendarAuthService.name);
  private oauth2Client: OAuth2Client;

  constructor(private readonly configService: ConfigService) {
    this.initializeOAuth();
  }

  private async initializeOAuth(): Promise<void> {
    try {
      // Initialize OAuth2 client for all operations
      this.oauth2Client = new OAuth2Client(
        this.configService.get<string>('googleCalendar.clientId'),
        this.configService.get<string>('googleCalendar.clientSecret'),
        this.configService.get<string>('googleCalendar.redirectUri'),
      );

      // Set credentials if we have stored tokens
      const accessToken = this.configService.get<string>(
        'googleCalendar.accessToken',
      );
      const refreshToken = this.configService.get<string>(
        'googleCalendar.refreshToken',
      );

      this.logger.log(
        `DEBUG: Access token exists: ${!!accessToken}, Refresh token exists: ${!!refreshToken}`,
      );

      if (accessToken && refreshToken) {
        this.oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        this.logger.log('OAuth2 credentials loaded from environment');
      } else {
        this.logger.warn(
          'No OAuth2 tokens found. Calendar operations will require authorization.',
        );
      }

      this.logger.log('Google Calendar auth service initialized with OAuth2');
    } catch (error) {
      this.logger.error(
        `Failed to initialize Google Calendar auth service: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    }
  }

  /**
   * Ensures OAuth2 credentials are valid and refreshes access token if needed
   */
  async ensureValidCredentials(ctx: RequestContext): Promise<void> {
    const accessToken = this.configService.get<string>(
      'googleCalendar.accessToken',
    );
    const refreshToken = this.configService.get<string>(
      'googleCalendar.refreshToken',
    );

    if (!accessToken || !refreshToken) {
      throw new Error(
        'OAuth2 credentials not found. Please authorize the application.',
      );
    }

    // Set current credentials
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.logger.log('OAuth2 credentials loaded from environment');

    // Try to refresh the access token
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);

      // Update the stored access token if it was refreshed
      if (
        credentials.access_token &&
        credentials.access_token !== accessToken
      ) {
        this.logger.log('Access token refreshed successfully');
        this.logger.log(
          `New access token: ${credentials.access_token.slice(0, 20)}...`,
        );
      }

      this.logger.log(
        'Skipping calendar access test - will test during API calls',
      );
    } catch (refreshError) {
      this.logger.error(
        `Failed to refresh access token: ${
          refreshError instanceof Error ? refreshError.message : 'Unknown error'
        }`,
      );

      throw new Error(
        'Refresh token expired. Please re-authorize the application.',
      );
    }
  }

  /**
   * Makes authenticated API requests to Google Calendar
   */
  async makeCalendarApiRequest(
    ctx: RequestContext,
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any,
  ): Promise<any> {
    // Ensure OAuth2 credentials are set and refreshed before making the API call
    await this.ensureValidCredentials(ctx);

    // Get the refreshed access token
    const credentials = this.oauth2Client.credentials;
    if (!credentials.access_token) {
      throw new Error('No access token available');
    }

    const requestOptions: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get the OAuth2 client instance
   */
  getOAuth2Client(): OAuth2Client {
    return this.oauth2Client;
  }
}
