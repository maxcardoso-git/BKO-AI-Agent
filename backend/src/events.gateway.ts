import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: [
      'http://72.61.52.70:3205',
      'http://72.61.52.70:3210',
      'http://localhost:3000',
      'http://localhost:3205',
      'http://localhost:3210',
    ],
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    client.emit('connected', { message: 'BKO Agent connected' });
  }

  handleDisconnect(_client: Socket) {}

  emitExecutionUpdate(complaintId: string, payload: Record<string, unknown>) {
    this.server.emit('execution:update', { complaintId, ...payload });
  }

  emitTicketUpdate(complaintId: string, payload: Record<string, unknown>) {
    this.server.emit('ticket:update', { complaintId, ...payload });
  }
}
