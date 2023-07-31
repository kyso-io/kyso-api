import { Token, TokenStatusEnum, WebSocketEvent } from '@kyso-io/kyso-model';
import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Autowired } from '../../decorators/autowired';
import { AuthService } from '../auth/auth.service';

@WebSocketGateway({
  cors: '*:*',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  @Autowired({ typeName: 'AuthService' })
  private authService: AuthService;

  private userIdToSocketId: Map<string, string>;
  private socketIdToUserId: Map<string, string>;
  private tokenToUserId: Map<string, string>;

  constructor() {
    this.userIdToSocketId = new Map<string, string>();
    this.socketIdToUserId = new Map<string, string>();
    this.tokenToUserId = new Map<string, string>();
  }

  public afterInit(server: Server): void {
    Logger.log('Initialized', EventsGateway.name);
  }

  public handleConnection(socket: Socket, ...args: any[]): void {
    Logger.log('New client connected', EventsGateway.name);
    if (socket.handshake?.headers?.authorization && socket.handshake.headers.authorization.startsWith('Bearer ')) {
      try {
        const jwtToken: string = socket.handshake.headers.authorization.split(' ')[1];
        const tokenStatus: TokenStatusEnum = this.authService.verifyToken(jwtToken);
        if (tokenStatus !== TokenStatusEnum.VALID) {
          socket.disconnect();
          return;
        }
        const token: Token = this.authService.decodeToken(jwtToken);
        (socket as any).user = token;
        this.userIdToSocketId.set(token.id, socket.id);
        this.socketIdToUserId.set(socket.id, token.id);
        this.tokenToUserId.set(jwtToken, token.id);
        Logger.log(`User '${token.id} - ${token.username}' conected to websocket`, EventsGateway.name);
      } catch (e) {
        Logger.error(`An error occurred while trying to authenticate the client`, e, EventsGateway.name);
        socket.disconnect();
      }
    } else {
      socket.disconnect();
    }
  }

  public handleDisconnect(socket: Socket): void {
    Logger.log('Client disconnected', EventsGateway.name);
    if ((socket as any)?.user) {
      const token: Token = (socket as any).user;
      this.userIdToSocketId.delete(token.id);
      this.socketIdToUserId.delete(socket.id);
      for (const [jwtToken, userId] of this.tokenToUserId.entries()) {
        if (userId === token.id) {
          this.tokenToUserId.delete(jwtToken);
          break;
        }
      }
      Logger.log(`User '${token.id} - ${token.username}' disconnected from websocket`, EventsGateway.name);
    }
  }

  public sendToUser(userId: string, webSocketEvent: WebSocketEvent, data: any): void {
    const socketId: string = this.userIdToSocketId.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(webSocketEvent, data);
    }
  }

  public sendToUsers(userIds: string[], webSocketEvent: WebSocketEvent, data: any): void {
    userIds.forEach((userId: string) => {
      this.sendToUser(userId, webSocketEvent, data);
    });
  }
}
