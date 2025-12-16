import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { basicAdminAuth } from '../lib/adminAuth';

const router = Router();

// Admin: Get all chats (MUST be before /:id route to avoid conflicts)
router.get('/all', basicAdminAuth, async (_req, res) => {
  try {
    const chats = await prisma.chat.findMany({
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Get only the latest message for preview
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(chats);
  } catch (error: any) {
    console.error('Failed to get chats:', error);
    res.status(500).json({ error: error.message || 'Failed to get chats' });
  }
});

// Get user's chats (by userId or email) - MUST be before /:id route
router.get('/user/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Try to find chats by userId or email
    const chats = await prisma.chat.findMany({
      where: {
        OR: [
          { userId: identifier },
          { userEmail: identifier }
        ]
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Get latest message for preview
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(chats);
  } catch (error: any) {
    console.error('Failed to get user chats:', error);
    res.status(500).json({ error: error.message || 'Failed to get user chats' });
  }
});

// Create a new chat session
router.post('/', async (req, res) => {
  try {
    const { userId, userName, userEmail } = req.body;
    
    const chat = await prisma.chat.create({
      data: {
        userId: userId || null,
        userName: userName || null,
        userEmail: userEmail || null,
        status: 'bot'
      }
    });

    // Add initial bot greeting message
    await prisma.chatMessage.create({
      data: {
        chatId: chat.id,
        senderType: 'bot',
        senderName: 'TConnect Bot',
        content: `Hello! 👋 Welcome to TConnect Store. Thank you for contacting us. Our team will reply to you in a few minutes. Please feel free to share your question or concern, and we'll get back to you as soon as possible!`
      }
    });

    const chatWithMessages = await prisma.chat.findUnique({
      where: { id: chat.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });

    res.json(chatWithMessages);
  } catch (error: any) {
    console.error('Failed to create chat:', error);
    res.status(500).json({ error: error.message || 'Failed to create chat' });
  }
});

// Get a chat by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const chat = await prisma.chat.findUnique({
      where: { id },
      include: { 
        messages: { 
          orderBy: { createdAt: 'asc' } 
        } 
      }
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json(chat);
  } catch (error: any) {
    console.error('Failed to get chat:', error);
    res.status(500).json({ error: error.message || 'Failed to get chat' });
  }
});

// Send a message in a chat
router.post('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, senderType, senderId, senderName, imageUrl } = req.body;

    if ((!content || !content.trim()) && !imageUrl) {
      return res.status(400).json({ error: 'Content or imageUrl is required' });
    }

    if (!senderType) {
      return res.status(400).json({ error: 'senderType is required' });
    }

    // Check if chat exists
    const chat = await prisma.chat.findUnique({ where: { id } });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Create the message
    const message = await prisma.chatMessage.create({
      data: {
        chatId: id,
        senderType,
        senderId: senderId || null,
        senderName: senderName || null,
        content: content || (imageUrl ? '[Image]' : ''),
        imageUrl: imageUrl || null
      }
    });

    // If user sends message and chat is in bot mode, switch to waiting and send confirmation
    if (senderType === 'user' && chat.status === 'bot') {
      await prisma.chat.update({
        where: { id },
        data: { status: 'waiting' }
      });

      // Send confirmation message that admin will reply soon
      await prisma.chatMessage.create({
        data: {
          chatId: id,
          senderType: 'bot',
          senderName: 'TConnect Bot',
          content: 'Thank you for your message! Our support team has been notified and will reply to you shortly. Please wait for an agent to join the chat.'
        }
      });
    }

    // Create notifications
    try {
      if (senderType === 'user') {
        // Notify admin about new user message
        await prisma.notification.create({
          data: {
            userId: null, // Admin notification
            type: 'message_received',
            title: 'New Message Received',
            message: `${senderName || 'User'} sent a message${content && content.length > 50 ? ': ' + content.substring(0, 50) + '...' : ''}`,
            link: `/admin?tab=chats&chatId=${id}`
          }
        });
        console.log('✅ Notification created for admin (user message)');
      } else if (senderType === 'agent' && chat.userId) {
        // Notify user about admin reply
        await prisma.notification.create({
          data: {
            userId: chat.userId,
            type: 'message_received',
            title: 'New Reply from Support',
            message: `${senderName || 'Support'} replied to your message`,
            link: `/`
          }
        });
        console.log('✅ Notification created for user (admin reply)');
      }
    } catch (notifError: any) {
      console.error('❌ Failed to create notification:', notifError?.message || notifError);
      // Don't fail message sending if notification fails
    }

    const updatedChat = await prisma.chat.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });

    res.json(updatedChat);
  } catch (error: any) {
    console.error('Failed to send message:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// Admin: Join a chat (agent joins)
router.post('/:id/join', basicAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { agentName } = req.body;

    if (!agentName || !agentName.trim()) {
      return res.status(400).json({ error: 'Agent name is required' });
    }

    const chat = await prisma.chat.findUnique({ where: { id } });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Update chat status (agentId is optional since we're using basic auth)
    await prisma.chat.update({
      where: { id },
      data: {
        status: 'active',
        agentId: null // We don't have user ID in basic auth, so set to null
      }
    });

    // Send agent joined message with their name
    await prisma.chatMessage.create({
      data: {
        chatId: id,
        senderType: 'agent',
        senderId: null, // No user ID with basic auth
        senderName: agentName.trim(),
        content: `${agentName.trim()} has joined the chat. How can I help you?`
      }
    });

    const chatWithMessages = await prisma.chat.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });

    res.json(chatWithMessages);
  } catch (error: any) {
    console.error('Failed to join chat:', error);
    res.status(500).json({ error: error.message || 'Failed to join chat' });
  }
});

// Admin: Send message as agent
router.post('/:id/agent-message', basicAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, imageUrl, agentName } = req.body;

    if ((!content || !content.trim()) && !imageUrl) {
      return res.status(400).json({ error: 'Content or imageUrl is required' });
    }

    const chat = await prisma.chat.findUnique({ where: { id } });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Ensure chat is active (agent joined)
    if (chat.status !== 'active') {
      await prisma.chat.update({
        where: { id },
        data: { status: 'active', agentId: null }
      });
    }

    await prisma.chatMessage.create({
      data: {
        chatId: id,
        senderType: 'agent',
        senderId: null, // No user ID with basic auth
        senderName: agentName || 'Support Agent',
        content: content || (imageUrl ? '[Image]' : ''),
        imageUrl: imageUrl || null
      }
    });

    // Notify user about admin reply
    try {
      if (chat.userId) {
        await prisma.notification.create({
          data: {
            userId: chat.userId,
            type: 'message_received',
            title: 'New Reply from Support',
            message: `${agentName || 'Support'} replied to your message`,
            link: `/`
          }
        });
        console.log('✅ Notification created for user (admin reply)');
      }
    } catch (notifError: any) {
      console.error('❌ Failed to create notification:', notifError?.message || notifError);
      // Don't fail message sending if notification fails
    }

    const updatedChat = await prisma.chat.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });

    res.json(updatedChat);
  } catch (error: any) {
    console.error('Failed to send agent message:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// Admin: Close a chat
router.post('/:id/close', basicAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const chat = await prisma.chat.findUnique({ where: { id } });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const updatedChat = await prisma.chat.update({
      where: { id },
      data: { status: 'closed' }
    });

    await prisma.chatMessage.create({
      data: {
        chatId: id,
        senderType: 'bot',
        senderName: 'System',
        content: 'This chat has been closed. Thank you for contacting TConnect Store!'
      }
    });

    res.json(updatedChat);
  } catch (error: any) {
    console.error('Failed to close chat:', error);
    res.status(500).json({ error: error.message || 'Failed to close chat' });
  }
});

export default router;
