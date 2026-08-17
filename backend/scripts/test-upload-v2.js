const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

async function testUpload() {
  console.log('Testing /api/v2/upload...');

  // Create a dummy sample image buffer
  const form = new FormData();
  const sampleBuffer = Buffer.from('Mock image payload for testing upload');
  form.append('file', sampleBuffer, {
    filename: 'test_delivery_receipt.jpg',
    contentType: 'image/jpeg',
  });

  try {
    const res = await axios.post('http://localhost:3000/api/v2/upload', form, {
      headers: form.getHeaders(),
    });

    console.log('Upload response:', res.data);
    if (res.data.success && res.data.data.fileUrl) {
      console.log('✔ [PASS] File uploaded successfully to:', res.data.data.fileUrl);

      // Now verify we can GET that file
      const getRes = await axios.get(`http://localhost:3000${res.data.data.fileUrl}`);
      if (getRes.status === 200) {
        console.log('✔ [PASS] Static file preview GET successful, length:', getRes.data.length);
      }
    }
  } catch (err) {
    console.error('Upload test failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

testUpload();
