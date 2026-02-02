import { useState, useMemo } from 'react';
import { Search, Grid, List, Loader2, LogOut } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useClassroomCourses } from '@/hooks/useClassroomApi';
import { ClassroomCourse } from '@/lib/classroomApi';
import { clearClassroomToken, getClassroomOAuthUrl, getClassroomToken } from '@/lib/classroomToken';
import { useAuthStore } from '@/store/useAuthStore';

interface ClassroomSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCourseSelect: (course: ClassroomCourse) => void;
}

export function ClassroomSelectionModal({ 
  isOpen, 
  onClose, 
  onCourseSelect 
}: ClassroomSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isChangingAccount, setIsChangingAccount] = useState(false);
  
  const { user } = useAuthStore();
  const isGoogleUser = (user as any)?.provider === 'google';
  
  const { 
    data: courses = [], 
    isLoading, 
    error,
    refetch 
  } = useClassroomCourses(isOpen);

  // Filter courses based on search term
  const filteredCourses = useMemo(() => {
    if (!searchTerm.trim()) return courses;
    
    const term = searchTerm.toLowerCase();
    return courses.filter(course => 
      course.name.toLowerCase().includes(term) ||
      course.description?.toLowerCase().includes(term) ||
      course.descriptionHeading?.toLowerCase().includes(term)
    );
  }, [courses, searchTerm]);

  const handleChangeAccount = async () => {
    try {
      setIsChangingAccount(true);
      
      // Clear the existing token
      clearClassroomToken();
      
      // Open the Classroom OAuth with prompt to select account
      const oauthUrl = getClassroomOAuthUrl(true); // true = force account selection
      const popup = window.open(
        oauthUrl,
        'classroom-oauth-popup',
        'width=500,height=600,scrollbars=yes,resizable=yes,left=' + 
        (window.screen.width / 2 - 250) + ',top=' + (window.screen.height / 2 - 300)
      );

      if (!popup) {
        throw new Error('Popup blocked');
      }

      // Listen for messages from the popup
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'CLASSROOM_AUTH_SUCCESS') {
          popup.close();
          window.removeEventListener('message', handleMessage);
          setIsChangingAccount(false);
          
          // Dispatch event to refresh token state
          window.dispatchEvent(new Event('classroom-auth-success'));
          
          // Small delay to ensure token state is updated before refetching
          setTimeout(() => {
            refetch();
          }, 100);
        } else if (event.data.type === 'CLASSROOM_AUTH_ERROR') {
          popup.close();
          window.removeEventListener('message', handleMessage);
          setIsChangingAccount(false);
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setIsChangingAccount(false);
        }
      }, 1000);

    } catch (error) {
      console.error('Error changing Google account:', error);
      setIsChangingAccount(false);
    }
  };

  const handleDisconnect = async () => {
    // Clear the existing token
    clearClassroomToken();
    window.dispatchEvent(new Event('classroom-auth-success')); // Trigger re-check
    
    // Immediately open OAuth to connect a different account
    try {
      const oauthUrl = getClassroomOAuthUrl(true); // force account selection
      const popup = window.open(
        oauthUrl,
        'classroom-oauth-popup',
        'width=500,height=600,scrollbars=yes,resizable=yes,left=' + 
        (window.screen.width / 2 - 250) + ',top=' + (window.screen.height / 2 - 300)
      );

      if (!popup) {
        console.error('Popup blocked');
        onClose();
        return;
      }

      // Listen for messages from the popup
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'CLASSROOM_AUTH_SUCCESS') {
          popup.close();
          window.removeEventListener('message', handleMessage);
          
          // Dispatch event to refresh token state
          window.dispatchEvent(new Event('classroom-auth-success'));
          
          // Small delay to ensure token state is updated before refetching
          setTimeout(() => {
            refetch();
          }, 100);
        } else if (event.data.type === 'CLASSROOM_AUTH_ERROR') {
          popup.close();
          window.removeEventListener('message', handleMessage);
          onClose();
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          // If user closed popup without connecting, close modal
          if (!getClassroomToken()) {
            onClose();
          }
        }
      }, 1000);

    } catch (error) {
      console.error('Error disconnecting and reconnecting:', error);
      onClose();
    }
  };

  const handleCourseClick = (course: ClassroomCourse) => {
    onCourseSelect(course);
  };

  if (error) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Google Classroom" size="xl">
        <div className="p-4 sm:p-6 text-center">
          <p className="text-red-400 mb-4">Failed to load Google Classroom courses.</p>
          <p className="text-sm text-zinc-400 mb-6">
            Please check your Google account permissions and try again.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={() => refetch()} variant="secondary">
              Retry
            </Button>
            <Button onClick={handleChangeAccount} variant="brand" loading={isChangingAccount}>
              Change Account
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Google Classroom Course" size="2xl">
      <div className="flex flex-col h-[70vh] sm:h-[600px]">
        {/* Header */}
        <div className="flex-shrink-0 p-3 sm:p-4 border-b border-zinc-800">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-3 sm:mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search classes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:outline-none text-sm sm:text-base"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleChangeAccount}
                loading={isChangingAccount}
                className="whitespace-nowrap text-sm"
              >
                Change account
              </Button>
              
              {/* Only show disconnect button if user is NOT signed in with Google */}
              {!isGoogleUser && (
                <button
                  onClick={handleDisconnect}
                  title="Disconnect Google Classroom"
                  className="p-2 rounded-lg text-zinc-400 hover:bg-red-900/30 hover:text-red-400 border border-zinc-600 border-0.5 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-zinc-700 text-white' 
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' 
                  ? 'bg-zinc-700 text-white' 
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading courses...</span>
              </div>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-zinc-400 mb-2">
                  {searchTerm ? 'No courses found matching your search.' : 'No courses available.'}
                </p>
                {searchTerm && (
                  <Button
                    variant="secondary"
                    onClick={() => setSearchTerm('')}
                    size="sm"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className={
              viewMode === 'grid' 
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'space-y-3'
            }>
              {filteredCourses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => handleCourseClick(course)}
                  className={`
                    border border-zinc-700 rounded-lg p-4 cursor-pointer
                    transition-colors hover:bg-zinc-800 hover:border-zinc-600
                    ${viewMode === 'grid' ? 'aspect-square flex flex-col' : 'flex items-center gap-4'}
                  `}
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-white mb-1 line-clamp-2">
                      {course.name}
                    </h3>
                    {/* {course.description && (
                      <p className="text-sm text-zinc-400 line-clamp-2">
                        {course.description}
                      </p>
                    )} */}
                    {/* {course.room && (
                      <p className="text-xs text-zinc-500 mt-1">
                        Room: {course.room}
                      </p>
                    )} */}
                  </div>
                  
                  {/* {course.enrollmentCode && (
                    <div className="mt-2 text-xs">
                      <span className="px-2 py-1 bg-zinc-700 text-zinc-300 rounded">
                        {course.enrollmentCode}
                      </span>
                    </div>
                  )} */}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}