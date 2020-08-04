const { VideoStream } = require('../lib/index');

const stream = new VideoStream({
        streamName: 'first',
        streamURL: 'rtsp://admin:admin@172.16.3.202:554',
        wsPort: 3000
});

stream.start();
