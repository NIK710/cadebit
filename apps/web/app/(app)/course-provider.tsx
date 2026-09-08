"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  createCourseRecord,
  parseStoredCourses,
  sampleCourses,
  type Course,
  type NewCourseInput,
} from "@/lib/courses";

type CourseContextValue = {
  courses: Course[];
  ready: boolean;
  createCourse: (input: NewCourseInput) => Course;
};

const CourseContext = createContext<CourseContextValue | null>(null);

export function CourseProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string;
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [ready, setReady] = useState(false);
  const storageKey = `cadebit:courses:${userId}`;

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) return;
      const storedCourses = parseStoredCourses(
        window.localStorage.getItem(storageKey),
      );
      setCourses(storedCourses ?? sampleCourses);
      setReady(true);
    });

    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (ready) window.localStorage.setItem(storageKey, JSON.stringify(courses));
  }, [courses, ready, storageKey]);

  const value = useMemo<CourseContextValue>(
    () => ({
      courses,
      ready,
      createCourse: (input) => {
        const course = createCourseRecord(input, crypto.randomUUID());
        setCourses((currentCourses) => [...currentCourses, course]);
        return course;
      },
    }),
    [courses, ready],
  );

  return (
    <CourseContext.Provider value={value}>{children}</CourseContext.Provider>
  );
}

export function useCourses(): CourseContextValue {
  const context = useContext(CourseContext);
  if (!context)
    throw new Error("useCourses must be used within CourseProvider.");
  return context;
}
