import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

/**
 * Redirect to live chat with openChat=chatId when user comes from old card-chat link.
 * Card payment flow now uses the main live chat (ChatWidget); agent creates the order manually in admin.
 */
const CheckoutCardChat: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const chatId = searchParams.get('chatId');

  useEffect(() => {
    if (chatId) {
      navigate(`/?openChat=${chatId}`, { replace: true });
    } else {
      navigate('/checkout', { replace: true });
    }
  }, [chatId, navigate]);

  return null;
};

export default CheckoutCardChat;
