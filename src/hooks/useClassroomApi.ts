import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import {
  fetchClassroomCourses,
  fetchCourseWork,
  fetchCourseAnnouncements,
  fetchCourseMaterials,
  filterCoursesByName,
  type ClassroomCourse,
  type CourseWork,
  type CourseAnnouncement,
  type CourseWorkMaterial,
} from '@/lib/classroomApi';
import { getClassroomToken, hasValidClassroomToken } from '@/lib/classroomToken';

/**
 * Hook to get the effective access token for Classroom API
 * Checks both the session (for Google-signed-in users) and localStorage (for connected accounts)
 */
function useClassroomAccessToken() {
  const { data: session } = useSession();
  const sessionToken = (session?.user as any)?.accessToken;
  const isGoogleUser = (session?.user as any)?.provider === 'google';
  
  // For Google users, use the session token
  // For other users, check localStorage for a connected Classroom token
  const [storedToken, setStoredToken] = useState<string | null>(null);
  
  useEffect(() => {
    // Check for stored token on mount and when session changes
    const token = getClassroomToken();
    setStoredToken(token);
  }, [session]);
  
  // Prefer session token for Google users, otherwise use stored token
  const accessToken = isGoogleUser ? sessionToken : (storedToken || sessionToken);
  const hasAccess = !!accessToken;
  
  return { accessToken, hasAccess, isGoogleUser };
}

/**
 * Hook to fetch user's Google Classroom courses
 */
export function useClassroomCourses(enabled = true) {
  const { accessToken, hasAccess } = useClassroomAccessToken();

  return useQuery({
    queryKey: ['classroom', 'courses', accessToken?.slice(-10)], // Include token suffix for cache invalidation
    queryFn: () => fetchClassroomCourses(accessToken!),
    enabled: enabled && hasAccess,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error?.message?.includes('401') || error?.message?.includes('403')) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook to fetch coursework for a specific course
 */
export function useCourseWork(courseId: string, enabled = true) {
  const { accessToken, hasAccess } = useClassroomAccessToken();

  return useQuery({
    queryKey: ['classroom', 'coursework', courseId, accessToken?.slice(-10)],
    queryFn: () => fetchCourseWork(courseId, accessToken!),
    enabled: enabled && !!courseId && hasAccess,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('401') || error?.message?.includes('403')) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook to fetch announcements for a specific course
 */
export function useCourseAnnouncements(courseId: string, enabled = true) {
  const { accessToken, hasAccess } = useClassroomAccessToken();

  return useQuery({
    queryKey: ['classroom', 'announcements', courseId, accessToken?.slice(-10)],
    queryFn: () => fetchCourseAnnouncements(courseId, accessToken!),
    enabled: enabled && !!courseId && hasAccess,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('401') || error?.message?.includes('403')) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook to fetch course materials (lectures, readings) for a specific course
 */
export function useCourseMaterials(courseId: string, enabled = true) {
  const { accessToken, hasAccess } = useClassroomAccessToken();

  return useQuery({
    queryKey: ['classroom', 'materials', courseId, accessToken?.slice(-10)],
    queryFn: () => fetchCourseMaterials(courseId, accessToken!),
    enabled: enabled && !!courseId && hasAccess,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('401') || error?.message?.includes('403')) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook to filter courses by search term
 */
export function useFilteredCourses(searchTerm: string) {
  const { data: courses, ...rest } = useClassroomCourses();

  const filteredCourses = courses ? filterCoursesByName(courses, searchTerm) : undefined;

  return {
    data: filteredCourses,
    ...rest,
  };
}

/**
 * Check if user has Google Classroom access
 * This checks both session tokens (for Google users) and stored tokens (for connected accounts)
 */
export function useHasClassroomAccess() {
  const { data: session, status } = useSession();
  const isGoogleUser = (session?.user as any)?.provider === 'google';
  const sessionAccessToken = !!(session?.user as any)?.accessToken;
  
  // Check for stored Classroom token (for non-Google users who connected their Classroom)
  const [hasStoredToken, setHasStoredToken] = useState(false);
  
  useEffect(() => {
    setHasStoredToken(hasValidClassroomToken());
  }, [session]);
  
  const hasAccess = (isGoogleUser && sessionAccessToken) || hasStoredToken;

  return {
    hasAccess,
    isGoogleUser,
    hasAccessToken: sessionAccessToken || hasStoredToken,
    hasStoredToken,
    isLoading: status === 'loading',
    session,
  };
}