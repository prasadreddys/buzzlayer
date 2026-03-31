import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Container, CssBaseline, Box, AppBar, Toolbar, Typography, Button, Card, CardContent, Grid, Chip, Avatar } from '@mui/material';
import { Twitter, AccountCircle, Leaderboard, Home, Settings } from '@mui/icons-material';
import axios from 'axios';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1DA1F2',
    },
    secondary: {
      main: '#ff4081',
    },
  },
});

interface User {
  _id: string;
  username: string;
  points: number;
  levels: string;
  tasksCompleted: number;
  twitterConnected: boolean;
  twitterUsername?: string;
}

interface Campaign {
  _id: string;
  name: string;
  description: string;
  taskType: string;
  rewardPoints: number;
  completedCount: number;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentView, setCurrentView] = useState<'home' | 'tasks' | 'leaderboard' | 'profile'>('home');
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    // Get Telegram WebApp data
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      const initData = tg.initData;
      // In a real app, you'd validate initData and extract user info
      console.log('Telegram init data:', initData);
    }

    // For development, we'll use a mock token
    const mockToken = localStorage.getItem('authToken');
    if (mockToken) {
      setToken(mockToken);
      loadUserData(mockToken);
    }
  }, []);

  const loadUserData = async (authToken: string) => {
    try {
      const [userRes, campaignsRes] = await Promise.all([
        axios.get('/api/users/me', { headers: { Authorization: `Bearer ${authToken}` } }),
        axios.get('/api/campaigns')
      ]);
      setUser(userRes.data);
      setCampaigns(campaignsRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const connectTwitter = async () => {
    if (!token) return;
    try {
      const response = await axios.get('/api/auth/twitter', {
        headers: { Authorization: `Bearer ${token}` }
      });
      window.open(response.data.url, '_blank');
    } catch (error) {
      console.error('Failed to get Twitter auth URL:', error);
    }
  };

  const completeTask = async (campaignId: string) => {
    if (!token) return;
    try {
      const response = await axios.post('/api/tasks/complete',
        { campaignId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUser(response.data.user);
      alert('Task completed successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to complete task');
    }
  };

  const renderHome = () => (
    <Box>
      <Typography variant="h4" gutterBottom>Welcome to X Growth Engine</Typography>
      {user && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6">Your Stats</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography>Points: {user.points}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography>Level: <Chip label={user.levels} color="primary" /></Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography>Tasks: {user.tasksCompleted}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography>Twitter: {user.twitterConnected ? `✅ @${user.twitterUsername}` : '❌ Not connected'}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
      {!user?.twitterConnected && (
        <Button variant="contained" startIcon={<Twitter />} onClick={connectTwitter} fullWidth>
          Connect Twitter Account
        </Button>
      )}
    </Box>
  );

  const renderTasks = () => (
    <Box>
      <Typography variant="h4" gutterBottom>Available Tasks</Typography>
      <Grid container spacing={2}>
        {campaigns.map((campaign) => (
          <Grid item xs={12} key={campaign._id}>
            <Card>
              <CardContent>
                <Typography variant="h6">{campaign.name}</Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {campaign.description}
                </Typography>
                <Typography variant="body2">
                  Type: {campaign.taskType} | Reward: {campaign.rewardPoints} points
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completed: {campaign.completedCount} times
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => completeTask(campaign._id)}
                  disabled={!user?.twitterConnected}
                  sx={{ mt: 1 }}
                >
                  Complete Task
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderLeaderboard = () => (
    <Box>
      <Typography variant="h4" gutterBottom>Leaderboard</Typography>
      <Typography>Coming soon...</Typography>
    </Box>
  );

  const renderProfile = () => (
    <Box>
      <Typography variant="h4" gutterBottom>Profile</Typography>
      {user && (
        <Card>
          <CardContent>
            <Avatar sx={{ width: 80, height: 80, mb: 2 }}>{user.username?.[0]?.toUpperCase()}</Avatar>
            <Typography variant="h6">@{user.username}</Typography>
            <Typography>Points: {user.points}</Typography>
            <Typography>Level: {user.levels}</Typography>
            <Typography>Tasks Completed: {user.tasksCompleted}</Typography>
            <Typography>Twitter: {user.twitterConnected ? `Connected (@${user.twitterUsername})` : 'Not connected'}</Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="sm">
        <AppBar position="static" sx={{ mb: 2 }}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              X Growth Engine
            </Typography>
          </Toolbar>
        </AppBar>

        <Box sx={{ mb: 2 }}>
          <Button
            startIcon={<Home />}
            onClick={() => setCurrentView('home')}
            variant={currentView === 'home' ? 'contained' : 'outlined'}
            sx={{ mr: 1 }}
          >
            Home
          </Button>
          <Button
            startIcon={<Settings />}
            onClick={() => setCurrentView('tasks')}
            variant={currentView === 'tasks' ? 'contained' : 'outlined'}
            sx={{ mr: 1 }}
          >
            Tasks
          </Button>
          <Button
            startIcon={<Leaderboard />}
            onClick={() => setCurrentView('leaderboard')}
            variant={currentView === 'leaderboard' ? 'contained' : 'outlined'}
            sx={{ mr: 1 }}
          >
            Leaderboard
          </Button>
          <Button
            startIcon={<AccountCircle />}
            onClick={() => setCurrentView('profile')}
            variant={currentView === 'profile' ? 'contained' : 'outlined'}
          >
            Profile
          </Button>
        </Box>

        {currentView === 'home' && renderHome()}
        {currentView === 'tasks' && renderTasks()}
        {currentView === 'leaderboard' && renderLeaderboard()}
        {currentView === 'profile' && renderProfile()}
      </Container>
    </ThemeProvider>
  );
}

export default App;