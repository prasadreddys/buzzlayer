import axios from 'axios';

const TWITTER_API_BASE = 'https://api.twitter.com/2';

export class TwitterAPI {
  constructor(accessToken) {
    this.accessToken = accessToken;
  }

  async makeRequest(endpoint, options = {}) {
    try {
      const response = await axios({
        url: `${TWITTER_API_BASE}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        ...options
      });
      return response.data;
    } catch (error) {
      console.error('Twitter API error:', error.response?.data || error.message);
      throw error;
    }
  }

  async verifyLike(tweetId, userId) {
    try {
      const data = await this.makeRequest(`/users/${userId}/liked_tweets`);
      return data.data.some(tweet => tweet.id === tweetId);
    } catch (error) {
      return false;
    }
  }

  async verifyRetweet(tweetId, userId) {
    try {
      const data = await this.makeRequest(`/tweets/${tweetId}/retweeted_by`);
      return data.data.some(user => user.id === userId);
    } catch (error) {
      return false;
    }
  }

  async verifyFollow(targetUserId, userId) {
    try {
      const data = await this.makeRequest(`/users/${userId}/following`);
      return data.data.some(user => user.id === targetUserId);
    } catch (error) {
      return false;
    }
  }

  async verifyComment(tweetId, userId, expectedText) {
    try {
      // Get replies to the tweet
      const data = await this.makeRequest(`/tweets/search/recent?query=conversation_id:${tweetId}&author_id:${userId}&max_results=10`);
      return data.data.some(tweet => tweet.text.includes(expectedText));
    } catch (error) {
      return false;
    }
  }

  async getUserInfo(userId) {
    return this.makeRequest(`/users/${userId}`);
  }

  async postTweet(text) {
    return this.makeRequest('/tweets', {
      method: 'POST',
      data: { text }
    });
  }

  async likeTweet(tweetId) {
    return this.makeRequest(`/users/likes`, {
      method: 'POST',
      data: { tweet_id: tweetId }
    });
  }

  async retweet(tweetId) {
    return this.makeRequest(`/tweets`, {
      method: 'POST',
      data: {
        text: `RT @${tweetId}`, // This might need adjustment based on actual retweet API
        reply: { in_reply_to_tweet_id: tweetId }
      }
    });
  }

  async followUser(targetUserId) {
    return this.makeRequest(`/users/${targetUserId}/following`, {
      method: 'POST'
    });
  }
}