#!/usr/bin/env node
/**
 * Upload student demo photos to Supabase Storage
 *
 * Usage: npx ts-node scripts/upload-student-photos.ts
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in environment
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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

async function assignPhotosToStudents() {
  console.log('📝 Assigning photos to students based on name...');

  // Male names pattern (from seed)
  const maleNames = [
    'Mamadou', 'Ibrahima', 'Ousmane', 'Sekou', 'Alpha', 'Mohamed', 'Abdoulaye', 'Amadou',
    'Cheick', 'Lansana', 'Sory', 'Boubacar', 'Mory', 'Fodé', 'Tidiane', 'Alsény',
    'Aboubacar', 'Kerfalla', 'Yaya', 'Mamadi', 'Laye', 'Amara', 'N\'Faly', 'Samba',
    'Mamady', 'Famory', 'Siaka'
  ];

  // Female names pattern (from seed)
  const femaleNames = [
    'Aïcha', 'Fatoumata', 'Mariama', 'Aminata', 'Hawa', 'Kadiatou', 'Bintou', 'Ramatoulaye',
    'Salimatou', 'Fanta', 'M\'Mah', 'Kadi', 'Aissatou', 'N\'Mah', 'Haby', 'Djenaba',
    'Koumba', 'Maimouna', 'Nantenin', 'Saran', 'Diané', 'Safi', 'Yarie', 'M\'Bali',
    'Hassatou', 'N\'Nawa', 'Kankou'
  ];

  // Build CASE statement for gender detection
  const maleConditions = maleNames.map(n => `nom ILIKE '${n} %' OR nom ILIKE '% ${n}'`).join(' OR ');
  const femaleConditions = femaleNames.map(n => `nom ILIKE '${n} %' OR nom ILIKE '% ${n}'`).join(' OR ');

  // First, assign boy photo to males
  const { error: maleError } = await supabase.rpc('exec_sql', {
    sql: `
      UPDATE students
      SET photo_url = 'students/verifycheck-student-boy.png'
      WHERE photo_url IS NULL
        AND (${maleConditions});
    `
  });

  if (maleError) {
    console.error('❌ Failed to assign male photos:', maleError.message);
  } else {
    console.log('✅ Assigned boy photo to male students');
  }

  // Then assign girl photo to females
  const { error: femaleError } = await supabase.rpc('exec_sql', {
    sql: `
      UPDATE students
      SET photo_url = 'students/verifycheck-student-girl.png'
      WHERE photo_url IS NULL
        AND (${femaleConditions});
    `
  });

  if (femaleError) {
    console.error('❌ Failed to assign female photos:', femaleError.message);
  } else {
    console.log('✅ Assigned girl photo to female students');
  }

  // Assign default (boy) to remaining
  const { error: defaultError } = await supabase.rpc('exec_sql', {
    sql: `
      UPDATE students
      SET photo_url = 'students/verifycheck-student-boy.png'
      WHERE photo_url IS NULL;
    `
  });

  if (defaultError) {
    console.error('❌ Failed to assign default photos:', defaultError.message);
  } else {
    console.log('✅ Assigned default photo to remaining students');
  }
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