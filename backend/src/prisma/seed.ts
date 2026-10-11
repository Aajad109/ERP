import { PrismaClient, Role, ComponentType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedDatabase() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
    console.log('[Seed] Production environment detected. Skipping seed (set ALLOW_SEED=true to seed initial demo accounts).');
    return;
  }

  console.log('[Seed] Resetting development database...');
  await prisma.eventRsvp.deleteMany({});
  await prisma.eventUpvote.deleteMany({});
  await prisma.campusEvent.deleteMany({});
  await prisma.itemClaim.deleteMany({});
  await prisma.lostAndFoundItem.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.resultVersionHistory.deleteMany({});
  await prisma.revaluationRequest.deleteMany({});
  await prisma.correctionRequest.deleteMany({});
  await prisma.publishedResult.deleteMany({});
  await prisma.attendanceRecord.deleteMany({});
  await prisma.attendanceSession.deleteMany({});
  await prisma.assessmentMark.deleteMany({});
  await prisma.assessmentComponent.deleteMany({});
  await prisma.timetableSlot.deleteMany({});
  await prisma.teachingAssignment.deleteMany({});
  await prisma.courseEnrollment.deleteMany({});
  await prisma.courseOffering.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.examAdminDesignation.deleteMany({});
  await prisma.announcement.deleteMany({});
  await prisma.studentProfile.deleteMany({});
  await prisma.facultyProfile.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.section.deleteMany({});
  await prisma.batch.deleteMany({});
  await prisma.department.deleteMany({});

  console.log('[Seed] Seeding mandatory college departments (CSE, Civil, Chemical, EEE)...');
  const cse = await prisma.department.create({ data: { code: 'CSE', name: 'Computer Science and Engineering' } });
  const civil = await prisma.department.create({ data: { code: 'CIVIL', name: 'Civil Engineering' } });
  const chem = await prisma.department.create({ data: { code: 'CHEM', name: 'Chemical Engineering' } });
  const eee = await prisma.department.create({ data: { code: 'EEE', name: 'Electrical and Electronics Engineering' } });

  console.log('[Seed] Seeding mandatory batches (2024-2028, 2025-2029, 2026-2030)...');
  const b24 = await prisma.batch.create({ data: { name: '2024-2028', startYear: 2024, endYear: 2028 } });
  const b25 = await prisma.batch.create({ data: { name: '2025-2029', startYear: 2025, endYear: 2029 } });
  const b26 = await prisma.batch.create({ data: { name: '2026-2030', startYear: 2026, endYear: 2030 } });

  console.log('[Seed] Seeding Sections A, B, C, D across batches and departments...');
  const departments = [cse, civil, chem, eee];
  const batches = [b24, b25, b26];
  const sectionNames = ['A', 'B', 'C', 'D'];

  const sectionMap: { [key: string]: any } = {};

  for (const b of batches) {
    for (const d of departments) {
      for (const s of sectionNames) {
        const sec = await prisma.section.create({
          data: {
            name: s,
            batchId: b.id,
            departmentId: d.id,
          },
        });
        sectionMap[`${b.name}_${d.code}_${s}`] = sec;
      }
    }
  }

  console.log('[Seed] Seeding Users with securely hashed passwords...');
  const salt = await bcrypt.genSalt(10);
  const hashAdmin = await bcrypt.hash('Admin@123', salt);
  const hashExam = await bcrypt.hash('Exam@123', salt);
  const hashFaculty = await bcrypt.hash('Faculty@123', salt);
  const hashStudent = await bcrypt.hash('Student@123', salt);

  // 1. Academic Admin
  const acadAdmin = await prisma.user.create({
    data: {
      email: 'academic.admin@college.edu',
      passwordHash: hashAdmin,
      name: 'Prof. John von Neumann',
      role: Role.ACADEMIC_ADMIN,
    },
  });

  // 2. Designated Examination Admin for CSE
  const examAdminCse = await prisma.user.create({
    data: {
      email: 'exam.admin.cse@college.edu',
      passwordHash: hashExam,
      name: 'Dr. Ada Lovelace',
      role: Role.EXAM_ADMIN,
      departmentId: cse.id,
    },
  });

  await prisma.examAdminDesignation.create({
    data: {
      userId: examAdminCse.id,
      departmentId: cse.id,
      isActive: true,
      assignedBy: 'BOARD_OF_EXAMINATIONS',
    },
  });

  // 3. Examination Admin for EEE (branch-isolation testing)
  const examAdminEee = await prisma.user.create({
    data: {
      email: 'exam.admin.eee@college.edu',
      passwordHash: hashExam,
      name: 'Dr. Nikola Tesla',
      role: Role.EXAM_ADMIN,
      departmentId: eee.id,
    },
  });

  await prisma.examAdminDesignation.create({
    data: {
      userId: examAdminEee.id,
      departmentId: eee.id,
      isActive: true,
      assignedBy: 'BOARD_OF_EXAMINATIONS',
    },
  });

  // 4. Faculty 1: Dr. Alan Turing (CSE)
  const facultyTuring = await prisma.user.create({
    data: {
      email: 'alan.turing@college.edu',
      passwordHash: hashFaculty,
      name: 'Dr. Alan Turing',
      role: Role.FACULTY,
      departmentId: cse.id,
    },
  });

  await prisma.facultyProfile.create({
    data: {
      userId: facultyTuring.id,
      employeeId: 'FAC-CSE-001',
      departmentId: cse.id,
      designation: 'Professor & Chair',
    },
  });

  // 5. Faculty 2: Dr. Grace Hopper (CSE)
  const facultyHopper = await prisma.user.create({
    data: {
      email: 'grace.hopper@college.edu',
      passwordHash: hashFaculty,
      name: 'Dr. Grace Hopper',
      role: Role.FACULTY,
      departmentId: cse.id,
    },
  });

  await prisma.facultyProfile.create({
    data: {
      userId: facultyHopper.id,
      employeeId: 'FAC-CSE-002',
      departmentId: cse.id,
      designation: 'Associate Professor',
    },
  });

  // 6. Student 1: Rahul Sharma (CSE, Batch 2024-2028, Section A)
  const sectionA_CSE_24 = sectionMap['2024-2028_CSE_A'];

  const studentRahulUser = await prisma.user.create({
    data: {
      email: 'rahul.cse@college.edu',
      passwordHash: hashStudent,
      name: 'Rahul Sharma',
      role: Role.STUDENT,
      departmentId: cse.id,
    },
  });

  const studentRahul = await prisma.studentProfile.create({
    data: {
      userId: studentRahulUser.id,
      rollNumber: '24CS001',
      departmentId: cse.id,
      batchId: b24.id,
      sectionId: sectionA_CSE_24.id,
    },
  });

  // 7. Student 2: Priya Patel (CSE, Batch 2024-2028, Section A)
  const studentPriyaUser = await prisma.user.create({
    data: {
      email: 'priya.cse@college.edu',
      passwordHash: hashStudent,
      name: 'Priya Patel',
      role: Role.STUDENT,
      departmentId: cse.id,
    },
  });

  const studentPriya = await prisma.studentProfile.create({
    data: {
      userId: studentPriyaUser.id,
      rollNumber: '24CS002',
      departmentId: cse.id,
      batchId: b24.id,
      sectionId: sectionA_CSE_24.id,
    },
  });

  console.log('[Seed] Seeding Course, Offering, Components...');
  const courseOs = await prisma.course.create({
    data: {
      code: 'CS301',
      title: 'Operating Systems',
      departmentId: cse.id,
      credits: 4,
      isTheory: true,
      isLab: false,
    },
  });

  const offeringOs = await prisma.courseOffering.create({
    data: {
      courseId: courseOs.id,
      batchId: b24.id,
      sectionId: sectionA_CSE_24.id,
      semester: 5,
      academicYear: '2024-2025',
      status: 'ACTIVE',
    },
  });

  await prisma.timetableSlot.createMany({
    data: [
      { offeringId: offeringOs.id, dayOfWeek: 'MON', startTime: '09:00', endTime: '10:00', roomNumber: 'LH-101' },
      { offeringId: offeringOs.id, dayOfWeek: 'WED', startTime: '10:00', endTime: '11:00', roomNumber: 'LH-101' },
      { offeringId: offeringOs.id, dayOfWeek: 'FRI', startTime: '11:00', endTime: '12:00', roomNumber: 'LH-101' },
    ],
  });

  // Components: Internal 40 (Mid-1: 15, Mid-2: 15, Quiz: 10) + External 60 = 100 Total
  const compMid1 = await prisma.assessmentComponent.create({
    data: {
      offeringId: offeringOs.id,
      name: 'Mid-1 Assessment',
      type: ComponentType.INTERNAL,
      maxMarks: 15,
      order: 1,
    },
  });

  const compMid2 = await prisma.assessmentComponent.create({
    data: {
      offeringId: offeringOs.id,
      name: 'Mid-2 Assessment',
      type: ComponentType.INTERNAL,
      maxMarks: 15,
      order: 2,
    },
  });

  const compQuiz = await prisma.assessmentComponent.create({
    data: {
      offeringId: offeringOs.id,
      name: 'Continuous Quizzes & Assignments',
      type: ComponentType.INTERNAL,
      maxMarks: 10,
      order: 3,
    },
  });

  const compEndSem = await prisma.assessmentComponent.create({
    data: {
      offeringId: offeringOs.id,
      name: 'End-Semester Theory Exam',
      type: ComponentType.EXTERNAL,
      maxMarks: 60,
      order: 4,
    },
  });

  console.log('[Seed] Seeding initial teaching assignment: Dr. Alan Turing for CS301 Sec A...');
  const pastStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  await prisma.teachingAssignment.create({
    data: {
      offeringId: offeringOs.id,
      facultyId: facultyTuring.id,
      startDate: pastStartDate,
      isActive: true,
      reason: 'Regular semester faculty allocation',
      assignedById: acadAdmin.id,
    },
  });

  console.log('[Seed] Enrolling students into CS301 Sec A...');
  await prisma.courseEnrollment.create({
    data: { offeringId: offeringOs.id, studentId: studentRahul.id },
  });
  await prisma.courseEnrollment.create({
    data: { offeringId: offeringOs.id, studentId: studentPriya.id },
  });

  console.log('[Seed] Seeding assessment marks for students...');
  await prisma.assessmentMark.create({
    data: {
      componentId: compMid1.id,
      studentId: studentRahul.id,
      offeringId: offeringOs.id,
      marksObtained: 12,
      recordedByFacultyId: facultyTuring.id,
      status: 'VERIFIED',
      version: 1,
    },
  });

  await prisma.assessmentMark.create({
    data: {
      componentId: compMid2.id,
      studentId: studentRahul.id,
      offeringId: offeringOs.id,
      marksObtained: 13,
      recordedByFacultyId: facultyTuring.id,
      status: 'VERIFIED',
      version: 1,
    },
  });

  await prisma.assessmentMark.create({
    data: {
      componentId: compQuiz.id,
      studentId: studentRahul.id,
      offeringId: offeringOs.id,
      marksObtained: 8,
      recordedByFacultyId: facultyTuring.id,
      status: 'VERIFIED',
      version: 1,
    },
  });

  await prisma.assessmentMark.create({
    data: {
      componentId: compMid1.id,
      studentId: studentPriya.id,
      offeringId: offeringOs.id,
      marksObtained: 14,
      recordedByFacultyId: facultyTuring.id,
      status: 'VERIFIED',
      version: 1,
    },
  });

  console.log('[Seed] Seeding a Published Result for Rahul Sharma (CS301, Grade A)...');
  const pubResult = await prisma.publishedResult.create({
    data: {
      offeringId: offeringOs.id,
      studentId: studentRahul.id,
      currentVersion: 1,
      internalMarks: 33,
      externalMarks: 42,
      totalMarks: 75,
      grade: 'A',
      gradePoint: 8,
      isPassed: true,
      sgpa: 8.0,
      cgpa: 8.0,
      cgpaStatus: 'OFFICIAL',
      publicationState: 'PUBLISHED',
      publishedByExamAdminId: examAdminCse.id,
    },
  });

  await prisma.resultVersionHistory.create({
    data: {
      resultId: pubResult.id,
      versionNumber: 1,
      internalMarks: 33,
      externalMarks: 42,
      totalMarks: 75,
      grade: 'A',
      gradePoint: 8,
      isPassed: true,
      sgpa: 8.0,
      cgpa: 8.0,
      cgpaStatus: 'OFFICIAL',
      changeType: 'INITIAL_PUBLICATION',
      reason: 'Regular end-semester published result',
      changedByUserId: examAdminCse.id,
    },
  });

  console.log('[Seed] Seeding historical attendance session by Dr. Alan Turing...');
  const session1 = await prisma.attendanceSession.create({
    data: {
      offeringId: offeringOs.id,
      facultyId: facultyTuring.id,
      topic: 'Introduction to Processes & Kernel Architecture',
      sessionDate: pastStartDate,
    },
  });

  await prisma.attendanceRecord.create({
    data: { sessionId: session1.id, studentId: studentRahul.id, isPresent: true, version: 1 },
  });
  await prisma.attendanceRecord.create({
    data: { sessionId: session1.id, studentId: studentPriya.id, isPresent: true, version: 1 },
  });

  // ---------------------------------------------------------
  // CAMPUS HUB: Lost & Found Items & Trending Events (Phase 2)
  // ---------------------------------------------------------
  console.log('[Seed] Seeding Campus Hub Lost & Found items...');
  const item1 = await prisma.lostAndFoundItem.create({
    data: {
      title: 'Casio fx-991EX Scientific Calculator',
      description: 'Found on desk row 4 after the CS301 mid-term examination. Black color with faint blue sticker.',
      type: 'FOUND',
      category: 'Electronics',
      location: 'CSE Block, Seminar Hall B',
      status: 'OPEN',
      reportedById: facultyTuring.id,
    },
  });

  const item2 = await prisma.lostAndFoundItem.create({
    data: {
      title: 'College ID Card & Lanyard (Rahul Sharma)',
      description: 'Blue college lanyard with student ID card 24CS001. Misplaced near the reading tables.',
      type: 'LOST',
      category: 'IDs & Cards',
      location: 'Central Library, 2nd Floor Reading Hall',
      status: 'OPEN',
      reportedById: studentRahulUser.id,
    },
  });

  const item3 = await prisma.lostAndFoundItem.create({
    data: {
      title: 'Boat Airdopes Charging Case (Black)',
      description: 'Found unattended on a cafeteria corner table during lunch break.',
      type: 'FOUND',
      category: 'Electronics',
      location: 'Main Student Canteen',
      status: 'OPEN',
      reportedById: studentPriyaUser.id,
    },
  });

  console.log('[Seed] Seeding Campus Hub Trending Events with Upvotes & RSVPs...');
  const eventDate1 = new Date();
  eventDate1.setDate(eventDate1.getDate() + 10);

  const eventDate2 = new Date();
  eventDate2.setDate(eventDate2.getDate() + 5);

  const eventDate3 = new Date();
  eventDate3.setDate(eventDate3.getDate() + 18);

  const event1 = await prisma.campusEvent.create({
    data: {
      title: 'Apex Hack 2026: 36-Hour National Hackathon',
      description: 'Flagship engineering hackathon featuring tracks in Distributed Systems, GenAI, and Sustainable Tech. Cash pool: ₹2,00,000.',
      category: 'Hackathon',
      venue: 'Main Campus Convention Center & Labs',
      eventDate: eventDate1,
      departmentId: cse.id,
      createdById: facultyTuring.id,
    },
  });

  const event2 = await prisma.campusEvent.create({
    data: {
      title: 'Embedded Systems & Robotics IoT Bootcamp',
      description: 'Intensive 2-day hands-on workshop building autonomous drone navigation with ESP32 & ROS2.',
      category: 'Workshop',
      venue: 'EEE Embedded Computing Lab 2',
      eventDate: eventDate2,
      departmentId: eee.id,
      createdById: examAdminEee.id,
    },
  });

  const event3 = await prisma.campusEvent.create({
    data: {
      title: 'Tarang 2026: Annual Cultural & Arts Festival',
      description: 'The pinnacle of creative expression featuring battle of the bands, classical dances, stage plays, and pro-nite!',
      category: 'Cultural',
      venue: 'Open Air Amphitheatre',
      eventDate: eventDate3,
      createdById: acadAdmin.id,
    },
  });

  // Seed upvotes & RSVPs
  await prisma.eventUpvote.create({
    data: { eventId: event1.id, userId: studentRahulUser.id },
  });
  await prisma.eventUpvote.create({
    data: { eventId: event1.id, userId: studentPriyaUser.id },
  });
  await prisma.eventUpvote.create({
    data: { eventId: event1.id, userId: facultyHopper.id },
  });

  await prisma.eventRsvp.create({
    data: { eventId: event1.id, userId: studentRahulUser.id, status: 'ATTENDING' },
  });
  await prisma.eventRsvp.create({
    data: { eventId: event1.id, userId: studentPriyaUser.id, status: 'ATTENDING' },
  });

  await prisma.eventUpvote.create({
    data: { eventId: event2.id, userId: studentRahulUser.id },
  });
  await prisma.eventRsvp.create({
    data: { eventId: event2.id, userId: studentRahulUser.id, status: 'INTERESTED' },
  });

  // Seed Official College Announcements
  await prisma.announcement.createMany({
    data: [
      {
        title: 'Fall 2026 End-Semester Examination Schedule Gazetted',
        content: 'The statutory end-semester examination timetable for all B.Tech branches has been officially released. Hall tickets will be available for download 7 days prior to commencement.',
        category: 'EXAMINATION',
        createdById: acadAdmin.id,
      },
      {
        title: 'Mandatory Internal Assessment Locking & Scrutiny Window',
        content: 'All faculty members are required to submit Mid-1, Mid-2, and laboratory assessments for branch examination admin verification before Friday 5:00 PM.',
        category: 'ACADEMIC',
        targetRole: Role.FACULTY,
        createdById: acadAdmin.id,
      },
      {
        title: 'Apex HackFest 2026: Registrations Now Live in Campus Hub',
        content: 'The 48-hour flagship hackathon on AI Systems and Cloud Infrastructure is open for registrations. Teams of up to 4 members can register via Campus Hub.',
        category: 'CAMPUS',
        createdById: acadAdmin.id,
      },
    ],
  });

  console.log('[Seed] Database successfully seeded with full academic hierarchy & Campus Hub!');
}

if (require.main === module) {
  seedDatabase()
    .catch((e) => {
      console.error('[Seed Error]:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
