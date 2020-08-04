import ws from 'ws';
import { EventEmitter } from 'events';
import MPEG1Muxer from './MPEG1Muxer';
import config from './config.json';

export interface VideoStreamOptions {
        streamName: string;
        streamURL: string;
        wsPort: number;
        streamWidth?: number;
        streamHeight?: number;
        ffmpegOptions?: Array<string>;
        ffmpegPath?: string;
        captureRejections?: boolean;
}

const HEADER_FIRST_BYTES = 'jsmp';

class VideoStream extends EventEmitter {
        private options: VideoStreamOptions;

        private streamName: string;

        private streamURL: string;

        private streamWidth: number | null;

        private streamHeight: number | null;

        private server: ws.Server | null = null;

        private mpeg1Muxer: MPEG1Muxer | null = null;

        private gettingInputData: boolean = false;

        public constructor(options: VideoStreamOptions) {
                super(options);

                this.options = options;
                this.streamName = options.streamName;
                this.streamURL = options.streamURL;
                this.streamWidth = options.streamWidth ? options.streamWidth : null;
                this.streamHeight = options.streamHeight ? options.streamHeight : null;
        }

        public start = () => {
                this.startMPEG1Stream();
                this.openWS();
        };

        public stop = () => {
                if (this.mpeg1Muxer && this.server) {
                        this.mpeg1Muxer.closeStream();
                        this.server.close();
                }
        };

        private startMPEG1Stream = () => {
                this.mpeg1Muxer = new MPEG1Muxer({
                        streamName: this.streamName,
                        streamURL: this.streamURL,
                        ffmpegPath: this.options.ffmpegPath ? this.options.ffmpegPath : 'ffmpeg',
                        ffmpegOptions: this.options.ffmpegOptions
                });

                this.initMPEG1Callbacks();
        };

        private initMPEG1Callbacks = () => {
                if (this.mpeg1Muxer) {
                        this.mpeg1Muxer.on(config.events.sendFFMPEGData, (data: Buffer) => {
                                this.emit(config.events.sendFFMPEGData, data);
                        });

                        this.mpeg1Muxer.on(config.events.sendFFMPEGError, (_data: Buffer) => {
                                let size: Array<string> = [];
                                const data: string = _data.toString();

                                if (data.indexOf('Input #') !== -1) {
                                        this.gettingInputData = true;
                                }

                                if (data.indexOf('Output #') !== -1) {
                                        this.gettingInputData = false;
                                }

                                if (this.gettingInputData) {
                                        const match = data.match(/\d+x\d+/);
                                        if (match) {
                                                size = match;
                                        }

                                        if (size[0]) {
                                                size = size[0].split('x');

                                                if (!this.streamWidth) {
                                                        this.streamWidth = parseInt(size[0], 10);
                                                }

                                                if (!this.streamHeight) {
                                                        this.streamHeight = parseInt(size[1], 10);
                                                }
                                        }
                                }
                        });

                        this.mpeg1Muxer.on(config.events.sendFFMPEGError, (data) => {
                                global.process.stderr.write(data);
                        });
                }
        };

        private openWS = () => {
                this.server = new ws.Server({
                        port: this.options.wsPort
                });
                this.initWSCallbacks();
        };

        private sendFirstWSMessage = (socket: ws) => {
                const streamHeader = Buffer.alloc(8);

                streamHeader.write(HEADER_FIRST_BYTES);
                streamHeader.writeUInt16BE(this.streamWidth!, 4);
                streamHeader.writeUInt16BE(this.streamHeight!, 6);

                socket.send(streamHeader, {
                        binary: true
                });

                console.log(
                        `${this.streamName}: New WebSocket Connection (${
                                this.server!.clients.size
                        } total)`
                );
        };

        private broadcast = (data: Buffer) => {
                if (this.server) {
                        this.server.clients.forEach((client) => {
                                if (client.readyState === 1) {
                                        client.send(data);
                                } else {
                                        console.log('Error: Client not connected.');
                                }
                        });
                }
        };

        private initWSCallbacks = () => {
                if (this.server) {
                        this.server.on('connection', (socket) => {
                                this.sendFirstWSMessage(socket);
                                socket.on('close', () => {
                                        console.log(
                                                `${this.streamName}: Disconnected WebSocket (${
                                                        this.server!.clients.size
                                                } total)`
                                        );
                                });
                        });
                        this.on(config.events.sendFFMPEGData, (data: Buffer) => {
                                this.broadcast(data);
                        });
                }
        };
}

export default VideoStream;
