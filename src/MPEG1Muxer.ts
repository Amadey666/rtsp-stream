import childProcess from 'child_process';
import { EventEmitter } from 'events';
import config from './config.json';

export interface MPEG1MuxerOptions {
        streamURL: string;
        streamName: string;
        ffmpegPath: string;
        restartOnUnexpectedClose?: boolean;
        captureRejections?: boolean;
}

class MPEG1Muxer extends EventEmitter {
        private streamURL: string;

        private streamName: string;

        private ffmpegPath: string;

        private ffmpegOptions: Array<string> = [];

        private restartOnUnexpectedClose: boolean;

        private stream: childProcess.ChildProcessWithoutNullStreams | null = null;

        public constructor(options: MPEG1MuxerOptions) {
                super(options);

                this.streamURL = options.streamURL;
                this.streamName = options.streamName;
                this.ffmpegPath = options.ffmpegPath;
                this.restartOnUnexpectedClose = options.restartOnUnexpectedClose || true;

                this.initOptions();
                this.startStream();
        }

        private initOptions = () => {
                this.ffmpegOptions = [
                        '-rtsp_transport',
                        'tcp',
                        '-i',
                        this.streamURL,
                        '-f',
                        'mpegts',
                        '-codec:v',
                        'mpeg1video',
                        '-'
                ];
        };

        private initStreamCallbacks = () => {
                if (this.stream) {
                        this.stream.stdout.on('data', (data: Buffer) => {
                                this.emit(config.events.sendFFMPEGData, data);
                        });

                        this.stream.stderr.on('data', (data: Buffer) => {
                                this.emit(config.events.sendFFMPEGError, data);
                        });

                        this.stream.on('exit', (code: number, signal: string) => {
                                console.error(`${this.streamName} stream exited`);
                                console.log(code, signal);

                                if (signal !== 'SIGTERM' && this.restartOnUnexpectedClose) {
                                        this.startStream();
                                }
                        });
                }
        };

        public startStream = () => {
                console.log(`Start stream ${this.streamName}`);

                this.stream = childProcess.spawn(this.ffmpegPath, this.ffmpegOptions, {
                        detached: false
                });

                this.initStreamCallbacks();
        };

        public closeStream = () => {
                console.log(`Close stream ${this.streamName}`);

                if (this.stream) {
                        this.stream.kill();
                }
        };
}

export default MPEG1Muxer;
