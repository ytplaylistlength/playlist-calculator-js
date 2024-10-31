class PlaylistInfo {
    constructor(playlistId, fromVideo, toVideo, playback, key) {
        this.playlistId = playlistId;
        this.fromVideo = fromVideo;
        this.toVideo = toVideo;
        this.playback = playback;
        this.videoInfo = [];
        this.errors = [];
        this.totalDuration = 0;
        this.averageVideoLength = 0;
        this.key = key;
        this.topLong = [];
        this.topShort = [];
        this.playlistName = '';
        this.channelName = '';
        this.playlistImage = '';
        this.videoCount = 0;
        this.atCustomX = '';
        this.longestVideo = '';
        this.shortestVideo = '';
        this.iterations = 0;
    }

    convertSeconds(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        seconds = seconds % 60;
        return hours > 0
            ? `${hours} hours, ${minutes} minutes and ${seconds} seconds`
            : `${minutes} minutes and ${seconds} seconds`;
    }

    calculate() {
        if (
            this.fromVideo - 1 >= 0 &&
            this.fromVideo <= this.toVideo &&
            this.toVideo <= this.videoInfo.length
        ) {
            this.videoInfo = this.videoInfo.slice(this.fromVideo - 1, this.toVideo);
        }

        const duration = this.videoInfo.reduce((sum, item) => sum + item.duration, 0);
        this.videoInfo.sort((a, b) => b.duration - a.duration);

        this.totalDuration = this.convertSeconds(duration);
        this.averageVideoLength = this.convertSeconds(duration / this.videoInfo.length);
        this.videoCount = this.videoInfo.length;

        this.topLong = this.videoInfo.slice(0, 3);
        this.topShort = this.videoInfo.slice(-3).reverse();

        this.atCustomX = this.convertSeconds(duration / this.playback);
        this.longestVideo = this.convertSeconds(this.videoInfo[0]?.duration || 0);
        this.shortestVideo = this.convertSeconds(this.videoInfo[this.videoInfo.length - 1]?.duration || 0);
    }

    async getPlaylistInfo() {
        try {
            const response = await axios.get('https://youtube.googleapis.com/youtube/v3/playlists', {
                params: {
                    part: 'snippet',
                    id: this.playlistId,
                    key: this.key
                }
            });

            const data = response.data;
            if (!data.items || data.items.length === 0) {
                this.errors.push('Invalid playlist ID');
                return;
            }

            const playlist = data.items[0];
            this.playlistName = playlist.snippet.title;
            this.channelName = playlist.snippet.channelTitle;
            this.playlistImage = playlist.snippet.thumbnails.medium.url;

            await this.getAllVideosFromPlaylist();
        } catch (error) {
            this.errors.push(error.message);
        }
    }

    async getVideoInformation(videoIds) {
        try {
            const response = await axios.get('https://youtube.googleapis.com/youtube/v3/videos', {
                params: {
                    part: 'snippet,contentDetails',
                    maxResults: '50',
                    id: videoIds.join(','),
                    key: this.key
                }
            });

            response.data.items.forEach(item => {
                const duration = isodate.parse(item.contentDetails.duration).seconds();
                this.videoInfo.push({
                    id: item.id,
                    title: item.snippet.title,
                    thumb: item.snippet.thumbnails.medium.url,
                    duration: duration,
                    formattedDuration: this.convertSeconds(duration)
                });
            });
        } catch (error) {
            this.errors.push(error.message);
        }
    }

    async getAllVideosFromPlaylist(token = null) {
        if (this.iterations >= 6) return;

        const params = {
            part: 'contentDetails',
            maxResults: '50',
            playlistId: this.playlistId,
            key: this.key
        };

        if (token) params.pageToken = token;

        try {
            const response = await axios.get('https://youtube.googleapis.com/youtube/v3/playlistItems', { params });
            const videoIds = response.data.items.map(item => item.contentDetails.videoId);

            this.iterations++;
            await this.getVideoInformation(videoIds);

            if (response.data.nextPageToken) {
                await this.getAllVideosFromPlaylist(response.data.nextPageToken);
            }
        } catch (error) {
            this.errors.push(error.message);
        }
    }
}


module.exports = PlaylistInfo;
