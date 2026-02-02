import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { getClassroomOAuthUrl } from '@/lib/classroomToken';

interface GoogleAuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function GoogleAuthPromptModal({ isOpen, onClose, onSuccess }: GoogleAuthPromptModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnectGoogleClassroom = async () => {
    try {
      setIsLoading(true);
      
      // Open popup to Google OAuth for Classroom access only
      const oauthUrl = getClassroomOAuthUrl();
      const popup = window.open(
        oauthUrl,
        'classroom-oauth-popup',
        'width=500,height=600,scrollbars=yes,resizable=yes,left=' + 
        (window.screen.width / 2 - 250) + ',top=' + (window.screen.height / 2 - 300)
      );

      if (!popup) {
        throw new Error('Popup blocked');
      }

      // Listen for messages from the popup (when auth completes)
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'CLASSROOM_AUTH_SUCCESS') {
          popup.close();
          window.removeEventListener('message', handleMessage);
          setIsLoading(false);
          onSuccess?.();
          onClose();
        } else if (event.data.type === 'CLASSROOM_AUTH_ERROR') {
          popup.close();
          window.removeEventListener('message', handleMessage);
          setIsLoading(false);
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsLoading(false);
        }
      }, 1000);

      // Cleanup after 5 minutes
      setTimeout(() => {
        if (popup && !popup.closed) {
          popup.close();
        }
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        setIsLoading(false);
      }, 300000);

    } catch (error) {
      console.error('Error opening Google OAuth popup:', error);
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold text-white mb-4">
          Connect Google Classroom
        </h3>
        
        <p className="text-sm text-zinc-400 mb-4">
          To import assignments and materials from Google Classroom, you need to connect your Google account.
        </p>
        
        <p className="text-sm text-zinc-400 mb-6">
          <span className="text-green-400">✓</span> Your current account and projects will remain unchanged.
          <br />
          <span className="text-green-400">✓</span> We only access your Classroom data for importing.
        </p>
        
        <div className="space-y-3">
          <Button
            variant="brand"
            onClick={handleConnectGoogleClassroom}
            loading={isLoading}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Connecting...' : 'Connect Google Classroom'}
          </Button>
          
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
            className="w-full"
          >
            Cancel
          </Button>
          
          {isLoading && (
            <p className="text-xs text-blue-400 mt-3">
              A popup window will appear to sign in with Google...
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}