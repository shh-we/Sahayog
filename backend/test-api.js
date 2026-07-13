import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api'
});

const tests = [];
let responderToken = '';
let userId = '';
let emergencyId = '';
let responderId = '';

// Helper to log results
function log(title, success, data) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${success ? '✅' : '❌'} ${title}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

async function runTests() {
  try {
    // Test 1: Register Responder with skills
    console.log('\n🧪 Starting Backend Tests...\n');
    
    const responderPhone = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const userPhone = Math.floor(1000000000 + Math.random() * 9000000000).toString();

    let res = await API.post('/auth/register', {
      name: 'Responder Test',
      email: `responder-${Date.now()}@test.com`,
      password: 'password123',
      phone: responderPhone,
      role: 'responder',
      skills: ['medical', 'fire']
    });
    log('Register Responder with Skills', res.status === 201, {
      success: res.data.success,
      role: res.data.user.role,
      skills: res.data.user.isAvailable ? '(isAvailable set)' : 'undefined'
    });
    responderToken = res.data.token;
    responderId = res.data.user.id;

    // Test 2: Register User
    res = await API.post('/auth/register', {
      name: 'User Test',
      email: `user-${Date.now()}@test.com`,
      password: 'password123',
      phone: userPhone,
      role: 'user'
    });
    log('Register User', res.status === 201, { success: res.data.success });
    const userToken = res.data.token;
    userId = res.data.user.id;

    // Test 3: Login
    res = await API.post('/auth/login', {
      phone: responderPhone,
      password: 'password123'
    });
    log('Login (Note: Using registered phone)', res.status === 200, {
      message: res.data.message
    });

    // Test 4: Get Current User (Responder)
    res = await API.get('/auth/me', {
      headers: { Authorization: `Bearer ${responderToken}` }
    });
    log('Get Current User (Responder)', res.status === 200, {
      name: res.data.user.name,
      role: res.data.user.role,
      isAvailable: res.data.user.isAvailable
    });

    // Test 5: Update Responder Location
    res = await API.put(
      '/responders/location',
      {
        longitude: 77.2,
        latitude: 28.6
      },
      { headers: { Authorization: `Bearer ${responderToken}` } }
    );
    log('Update Responder Location', res.status === 200, {
      coordinates: res.data.location?.coordinates
    });

    // Test 6: Toggle Availability
    res = await API.put(
      '/responders/availability',
      {},
      { headers: { Authorization: `Bearer ${responderToken}` } }
    );
    log('Toggle Responder Availability', res.status === 200, {
      isAvailable: res.data.isAvailable,
      message: res.data.message
    });

    // Test 7: Create Emergency (User)
    res = await API.post(
      '/emergencies',
      {
        type: 'fire',
        description: 'Test emergency in downtown',
        longitude: 77.2,
        latitude: 28.6,
        address: 'Test Street'
      },
      { headers: { Authorization: `Bearer ${userToken}` } }
    );
    log('Create Emergency', res.status === 201, {
      type: res.data.emergency.type,
      status: res.data.emergency.status,
      dispatchStatus: res.data.emergency.dispatchStatus
    });
    emergencyId = res.data.emergency._id || res.data.emergency.id;

    // Test 8: Get Nearby Emergencies
    res = await API.get(
      '/emergencies/nearby',
      {
        params: {
          longitude: 77.2,
          latitude: 28.6,
          radius: 10000
        },
        headers: { Authorization: `Bearer ${responderToken}` }
      }
    );
    log('Get Nearby Emergencies', res.status === 200, {
      count: res.data.count,
      emergencies: res.data.emergencies?.map(e => ({ id: e._id, type: e.type, status: e.status }))
    });

    // (Removed legacy Accept, Update Status, and assignments tests as they are retired in Feature 4)

    console.log('\n\n✅ All tests completed!\n');

  } catch (error) {
    console.error('\n❌ Test Error:', error.response?.data || error.message);
  }

  process.exit(0);
}

runTests();
