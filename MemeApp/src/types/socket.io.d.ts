declare module 'socket.io' {
    export interface Socket {
        id: string;
        data: {
            userId: number;
            username: string;
            winning_message?: string;
        };
        request: any;
        emit(event: string, ...args: any[]): boolean;
        on(event: string, listener: Function): this;
        once(event: string, listener: Function): this;
        removeListener(event: string, listener: Function): this;
        removeAllListeners(event?: string): this;
        disconnect(close?: boolean): void;
        join(room: string): void;
    }

    export class Server {
        constructor(httpServer: any, options?: any);
        on(event: string, listener: Function): this;
        emit(event: string, ...args: any[]): boolean;
        use(fn: (socket: Socket, next: (err?: any) => void) => void): this;
        to(room: string): {
            emit: (event: string, ...args: any[]) => boolean;
        };
    }
}