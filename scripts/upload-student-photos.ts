#!/usr/bin/env node
/**
 * Upload student demo photos to Supabase Storage
 *
 * Usage: npx ts-node scripts/upload-student-photos.ts
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in environment
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  console.error('   Set them in .env.local or export before running');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const PHOTOS = [
  {
    localPath: '/home/marco/Downloads/verifycheck-student-boy.png',
    storagePath: 'students/verifycheck-student-boy.png',
    contentType: 'image/png',
  },
  {
    localPath: '/home/marco/Downloads/verifycheck-student-girl.png',
    storagePath: 'students/verifycheck-student-girl.png',
    contentType: 'image/png',
  },
];

async function uploadPhoto(photo: typeof PHOTOS[0]) {
  console.log(`📤 Uploading ${photo.storagePath}...`);

  const fileBuffer = fs.readFileSync(photo.localPath);
  const { data, error } = await supabase.storage
    .from('students')
    .upload(photo.storagePath, fileBuffer, {
      contentType: photo.contentType,
      upsert: true,
    });

  if (error) {
    console.error(`❌ Failed to upload ${photo.storagePath}:`, error.message);
    return false;
  }

  console.log(`✅ Uploaded: ${data.path}`);
  return true;
}

async function main() {
  console.log('🚀 Starting student photo upload...\n');

  // Check bucket exists
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.error('❌ Failed to list buckets:', bucketError.message);
    process.exit(1);
  }

  const studentsBucket = buckets.find(b => b.name === 'students');
  if (!studentsBucket) {
    console.error('❌ Bucket "students" does not exist. Create it in Supabase Dashboard first.');
    console.error('   Go to Storage > Create bucket > name: "students" > public: true');
    process.exit(1);
  }
  console.log('✅ Bucket "students" exists\n');

  // Upload photos
  for (const photo of PHOTOS) {
    if (!fs.existsSync(photo.localPath)) {
      console.error(`❌ Local file not found: ${photo.localPath}`);
      process.exit(1);
    }
    await uploadPhoto(photo);
  }

  console.log('');

  // Assign to students (requires exec_sql function or direct SQL)
  // Note: Direct SQL via Supabase JS client doesn't support raw UPDATE
  // You'll need to run the assignment SQL manually in Supabase Dashboard
  console.log('📋 Photos uploaded. Now run the assignment SQL in Supabase Dashboard:');
  console.log('   See supabase/migrations/2026-11-24_student_photos_storage.sql');
  console.log('   (Section 3: ASSIGN DEMO PHOTOS TO STUDENTS)');
}

main().catch(console.error);