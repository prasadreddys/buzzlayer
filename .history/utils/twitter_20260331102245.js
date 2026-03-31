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
      // Get user's liked tweets (paginated, but we'll check first page)
      const data = await this.makeRequest(`/users/${userId}/liked_tweets?max_results=100`);
      return data.data && data.data.some(tweet => tweet.id === tweetId);
    } catch (error) {
      console.error('Like verification error:', error.message);
      return false;
    }
  }

  async verifyRetweet(tweetId, userId) {
    try {
      // Search for retweets of the tweet by the user
      const data = await this.makeRequest(`/tweets/search/recent?query=retweets_of:${tweetId} from:${userId}&max_results=10`);
      return data.data && data.data.length > 0;
    } catch (error) {
      console.error('Retweet verification error:', error.message);
      return false;
    }
  }

  async verifyFollow(targetUserId, userId) {
    try {
      // Check if user is following the target
      const data = await this.makeRequest(`/users/${userId}/following?max_results=1000`);
      return data.data && data.data.some(user => user.id === targetUserId);
    } catch (error) {
      console.error('Follow verification error:', error.message);
      return false;
    }
  }

  async verifyComment(tweetId, userId, expectedText) {
    try {
      // Search for replies to the tweet by the user
      const data = await this.makeRequest(`/tweets/search/recent?query=conversation_id:${tweetId} from:${userId}&max_results=10`);
      if (!data.data) return false;

      // Check if any reply contains the expected text
      return data.data.some(tweet => {
        const text = tweet.text.toLowerCase();
        return expectedText.toLowerCase().split(' ').every(word =>
          text.includes(word.toLowerCase())
        );
      });
    } catch (error) {
      console.error('Comment verification error:', error.message);
      return false;
    }
  }
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
    // Note: Twitter API v2 doesn't have a direct retweet endpoint
    // You need to quote the tweet or use v1.1 API for native retweets
    return this.makeRequest('/tweets', {
      method: 'POST',
      data: {
        text: `RT @${tweetId}`,
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