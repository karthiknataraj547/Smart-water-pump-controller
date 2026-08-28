#pragma once
#ifndef _STDINT_H_STUB
#define _STDINT_H_STUB

typedef signed char        int8_t;
typedef short              int16_t;
typedef int                int32_t;
typedef long long          int64_t;

typedef unsigned char      uint8_t;
typedef unsigned short     uint16_t;
typedef unsigned int       uint32_t;
typedef unsigned long long uint64_t;

typedef int32_t            intptr_t;
typedef uint32_t           uintptr_t;

#ifndef UINT8_MAX
#define UINT8_MAX  0xFF
#endif
#ifndef UINT16_MAX
#define UINT16_MAX 0xFFFF
#endif
#ifndef UINT32_MAX
#define UINT32_MAX 0xFFFFFFFFU
#endif
#ifndef UINT64_MAX
#define UINT64_MAX 0xFFFFFFFFFFFFFFFFULL
#endif

#ifndef INT8_MAX
#define INT8_MAX   0x7F
#endif
#ifndef INT16_MAX
#define INT16_MAX  0x7FFF
#endif
#ifndef INT32_MAX
#define INT32_MAX  0x7FFFFFFF
#endif

#endif // _STDINT_H_STUB
