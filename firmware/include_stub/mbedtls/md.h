#ifndef MBEDTLS_MD_H_STUB
#define MBEDTLS_MD_H_STUB

#include <stdint.h>
#include <stddef.h>

typedef struct {
    int dummy;
} mbedtls_md_context_t;

typedef enum {
    MBEDTLS_MD_NONE=0,
    MBEDTLS_MD_MD5,
    MBEDTLS_MD_SHA1,
    MBEDTLS_MD_SHA256,
    MBEDTLS_MD_SHA512
} mbedtls_md_type_t;

typedef struct {
    int dummy;
} mbedtls_md_info_t;

inline const mbedtls_md_info_t* mbedtls_md_info_from_type(mbedtls_md_type_t md_type) {
    static mbedtls_md_info_t info;
    return &info;
}

inline void mbedtls_md_init(mbedtls_md_context_t *ctx) {}
inline void mbedtls_md_free(mbedtls_md_context_t *ctx) {}
inline int mbedtls_md_setup(mbedtls_md_context_t *ctx, const mbedtls_md_info_t *md_info, int hmac) { return 0; }
inline int mbedtls_md_hmac_starts(mbedtls_md_context_t *ctx, const unsigned char *key, size_t keylen) { return 0; }
inline int mbedtls_md_hmac_update(mbedtls_md_context_t *ctx, const unsigned char *input, size_t ilen) { return 0; }
inline int mbedtls_md_hmac_finish(mbedtls_md_context_t *ctx, unsigned char *output) { return 0; }

#endif // MBEDTLS_MD_H_STUB
